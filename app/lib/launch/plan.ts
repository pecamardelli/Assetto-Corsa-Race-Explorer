import { promises as fs } from 'fs';
import path from 'path';
import { getChampionship } from '../race-data';
import { getDriverProfiles } from '../driver-assets';
import {
  ChampionshipData,
  ChampionshipOpponent,
  ChampionshipRound,
  Season,
} from '../../types/race';
import { AC_CONTENT_TRACKS } from './paths';
import { GridEntry, LaunchMode, RaceIniSpec } from './race-ini';
import { resolveAssists } from './assists';
import { listWeathers, resolveRaceSpec, rollRaceSpec } from './race-spec';
import { AssistsConfig, AssistsSource } from '../../types/assists';

const AI_AGGRESSION_MIN = 80;
const AI_AGGRESSION_MAX = 100;

/** Every driver races at full strength unless their profile says otherwise. */
const DEFAULT_AI_LEVEL = 100;

export interface LaunchPlan {
  spec: RaceIniSpec;
  /** Game presets to write into cfg/assists.ini alongside race.ini. */
  assists: AssistsConfig;
  /** Whether the assists came from the season's own file or the global config. */
  assistsSource: AssistsSource;
  championshipName: string;
  seasonNumber: number;
  seasonFolder: string;
  roundNumber: number;
  /** Track with its layout re-joined, matching how rounds are keyed elsewhere. */
  roundTrack: string;
  trackLabel: string;
  /**
   * Whether whatever AC writes belongs in the season. False for a round driven
   * again after it was raced: the session runs, but nothing is filed.
   */
  record: boolean;
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Split a round's track string into AC's folder + layout pair.
 *
 * Splitting on the last hyphen is not safe on its own: several track folders have
 * a hyphen in the name with no layout at all ("monza_faux_pre-war"), and one has
 * both ("autodrome_de_linas-montlhery-full"). So the installed content decides,
 * and the naive split is only the fallback when AC is not reachable.
 */
export async function resolveTrack(
  roundTrack: string
): Promise<{ track: string; trackConfig: string }> {
  if (await isDirectory(path.join(AC_CONTENT_TRACKS, roundTrack))) {
    return { track: roundTrack, trackConfig: '' };
  }

  const cut = roundTrack.lastIndexOf('-');
  if (cut === -1) return { track: roundTrack, trackConfig: '' };

  return { track: roundTrack.slice(0, cut), trackConfig: roundTrack.slice(cut + 1) };
}

/**
 * The driver seat the user occupies. player.json is the profile the app already
 * keeps for them, so its name doubles as the entry to pull out of the grid.
 */
export async function resolvePlayerName(): Promise<string> {
  if (process.env.AC_PLAYER_NAME) return process.env.AC_PLAYER_NAME;

  try {
    const contents = await fs.readFile(
      path.join(process.cwd(), 'app', 'lib', 'driver-profiles', 'player.json'),
      'utf8'
    );
    const profile = JSON.parse(contents) as { name?: string };
    if (profile.name) return profile.name;
  } catch {
    // fall through
  }

  return 'PLAYER';
}

function randomAggression(): number {
  return (
    AI_AGGRESSION_MIN + Math.floor(Math.random() * (AI_AGGRESSION_MAX - AI_AGGRESSION_MIN + 1))
  );
}

function toGridEntry(
  opponent: ChampionshipOpponent,
  aiLevel: number,
  aiAggression: number
): GridEntry {
  return {
    car: opponent.car,
    skin: opponent.skin,
    name: opponent.name,
    nation: opponent.nation,
    aiLevel,
    aiAggression,
  };
}

function findSeason(seasons: Season[], seasonId: string): Season | undefined {
  return seasons.find(
    season => season.seasonName.toLowerCase().replace(' ', '_') === seasonId.toLowerCase()
  );
}

export class LaunchPlanError extends Error {}

/**
 * Turn a round on a season page into everything needed to write race.ini and to
 * file the results away afterwards.
 */
export async function buildLaunchPlan(
  champId: string,
  seasonId: string,
  roundNumber: number,
  mode: LaunchMode,
  record = true
): Promise<LaunchPlan> {
  const championship = await getChampionship(champId);
  if (!championship) throw new LaunchPlanError(`Unknown championship "${champId}"`);

  const season = findSeason(championship.seasons, seasonId);
  if (!season) throw new LaunchPlanError(`Unknown season "${seasonId}"`);

  const data: ChampionshipData = season.data;
  const round: ChampionshipRound | undefined = data.rounds[roundNumber - 1];
  if (!round) throw new LaunchPlanError(`Round ${roundNumber} is not in this season`);

  const playerName = await resolvePlayerName();
  const playerEntry = data.opponents.find(
    opponent => opponent.name === playerName || opponent.name === 'PLAYER'
  );
  if (!playerEntry) {
    throw new LaunchPlanError(
      `No entry for "${playerName}" in this season — set AC_PLAYER_NAME or add them to the .champ`
    );
  }

  const profiles = await getDriverProfiles(
    data.opponents.map(opponent => opponent.name),
    data.name
  );

  const opponents = data.opponents
    .filter(entry => entry.name !== playerEntry.name)
    .map(entry =>
      toGridEntry(
        entry,
        profiles.get(entry.name)?.skill ?? DEFAULT_AI_LEVEL,
        randomAggression()
      )
    );

  const { track, trackConfig } = await resolveTrack(round.track);

  const seasonFolder = `season_${String(season.seasonNumber).padStart(2, '0')}`;
  const { assists, source: assistsSource } = await resolveAssists(
    championship.folderName,
    seasonFolder
  );

  // The round's own settings if it has been edited, the championship's otherwise.
  const weathers = await listWeathers();
  const resolved = await resolveRaceSpec(
    championship.folderName,
    seasonFolder,
    data,
    roundNumber
  );
  if (!resolved) throw new LaunchPlanError(`Round ${roundNumber} is not in this season`);

  const spec: RaceIniSpec = {
    mode,
    track,
    trackConfig,
    // Anything the round leaves to chance is drawn here, so race.ini only ever
    // carries settled conditions.
    race: rollRaceSpec(resolved.spec, weathers),
    player: toGridEntry(playerEntry, DEFAULT_AI_LEVEL, AI_AGGRESSION_MAX),
    opponents,
  };

  return {
    spec,
    assists,
    assistsSource,
    championshipName: championship.folderName,
    seasonNumber: season.seasonNumber,
    seasonFolder,
    roundNumber,
    roundTrack: round.track,
    trackLabel: trackConfig ? `${track} (${trackConfig})` : track,
    record,
  };
}
