import { promises as fs } from 'fs';
import path from 'path';
import { getChampionship } from '../race-data';
import { getDriverProfiles } from '../driver-assets';
import {
  ChampionshipData,
  ChampionshipOpponent,
  ChampionshipRound,
  RaceSession,
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

/**
 * One batch of a round that is too big for its track.
 *
 * The groups of a round are raced one after another and classified together, so the
 * label is what ties them back into a single result — see `mergeGroupedRounds`.
 */
export interface LaunchGroup {
  /** Short and stable: "A", "B", "Over 1500cc". Shown on the round's results. */
  label: string;
  /** Roster names racing in this batch. */
  drivers: string[];
}

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
  /** Set only when this launch is one batch of a round split across several. */
  group?: string;
  /**
   * True when the seat at CAR_0 belongs to somebody other than the player, which
   * happens for a group they are not entered in. The session still has to be
   * started by hand, so the caller is told to hand the car over to the AI.
   */
  aiSeat?: boolean;
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

/**
 * The qualifying a round would take its grid from.
 *
 * Sessions are paired to rounds by track exactly as the season page does it — the
 * round's track string appears in the filename the result was filed under. Where a
 * round has been qualified more than once the last one wins, since a season's
 * sessions arrive oldest first and the newest run is the one that settled the grid.
 */
export function findRoundQualifying(
  season: Season,
  roundTrack: string,
  /** When the race is one batch of a split round, only that batch's own grid will do. */
  group?: string
): RaceSession | null {
  const qualifying = season.sessions.filter(session => {
    const name = session.filename.split('/').pop() ?? '';
    const type = session.data.session_type ?? session.data.session_info.session_type;
    if (!name.includes(roundTrack) || type !== 'qualifying') return false;

    // Groups qualify separately, so a group's race must not inherit the order another
    // group set. A round raced whole ignores any group qualifying that came before.
    return (session.data.session_info.group ?? undefined) === group;
  });

  return qualifying.at(-1) ?? null;
}

/** Drivers from a session's classification, pole first; the unclassified left out. */
function classificationOrder(session: RaceSession): string[] {
  return Object.entries(session.data.driver_statistics)
    .filter(([, stats]) => typeof stats.position === 'number')
    .sort(([, a], [, b]) => (a.position as number) - (b.position as number))
    .map(([name]) => name);
}

export class LaunchPlanError extends Error {}

/**
 * Turn a round on a season page into everything needed to write race.ini and to
 * file the results away afterwards.
 */
/**
 * The batch of the roster that is going out, in roster order.
 *
 * Every name has to be one of the season's own, and a batch of one is not a race —
 * a typo that quietly dropped half the field would otherwise only show up in the
 * results.
 */
function restrictToGroup(
  opponents: ChampionshipOpponent[],
  group: LaunchGroup
): ChampionshipOpponent[] {
  const wanted = new Set(group.drivers);
  const field = opponents.filter(opponent => wanted.has(opponent.name));

  const known = new Set(opponents.map(opponent => opponent.name));
  const strangers = group.drivers.filter(name => !known.has(name));
  if (strangers.length) {
    throw new LaunchPlanError(
      `Group "${group.label}" names drivers who are not in this season: ${strangers.join(', ')}`
    );
  }

  if (field.length < 2) {
    throw new LaunchPlanError(`Group "${group.label}" needs at least two drivers`);
  }

  return field;
}

export async function buildLaunchPlan(
  champId: string,
  seasonId: string,
  roundNumber: number,
  mode: LaunchMode,
  record = true,
  /** Omitted for a round raced whole, which is every round that fits its track. */
  group?: LaunchGroup
): Promise<LaunchPlan> {
  const championship = await getChampionship(champId);
  if (!championship) throw new LaunchPlanError(`Unknown championship "${champId}"`);

  const season = findSeason(championship.seasons, seasonId);
  if (!season) throw new LaunchPlanError(`Unknown season "${seasonId}"`);

  const data: ChampionshipData = season.data;
  const round: ChampionshipRound | undefined = data.rounds[roundNumber - 1];
  if (!round) throw new LaunchPlanError(`Round ${roundNumber} is not in this season`);

  const playerName = await resolvePlayerName();
  const seasonEntry = data.opponents.find(
    opponent => opponent.name === playerName || opponent.name === 'PLAYER'
  );
  if (!seasonEntry) {
    throw new LaunchPlanError(
      `No entry for "${playerName}" in this season — set AC_PLAYER_NAME or add them to the .champ`
    );
  }

  const field = group ? restrictToGroup(data.opponents, group) : data.opponents;

  /**
   * AC gives CAR_0 to whoever is at the keyboard and offers no way to leave it
   * empty, so a group the player is not entered in still has to put one of its own
   * drivers in that seat — otherwise the batch would either race a car short or
   * carry a driver who does not belong to it. The first of the group takes it, and
   * the session is handed straight to the AI with the Activate AI control.
   */
  const playerEntry = field.includes(seasonEntry) ? seasonEntry : field[0];
  const aiSeat = playerEntry !== seasonEntry;

  const profiles = await getDriverProfiles(
    data.opponents.map(opponent => opponent.name),
    data.name
  );

  const opponents = field
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

  // A race on its own has no qualifying ahead of it to line the field up, so the
  // one already filed for this round stands in for it.
  let gridOrder: string[] | undefined;

  if (mode === 'race') {
    const qualifying = findRoundQualifying(season, round.track, group?.label);
    if (!qualifying) {
      throw new LaunchPlanError(
        group
          ? `Group "${group.label}" of round ${roundNumber} has no qualifying result to build a grid from — race the weekend instead`
          : `Round ${roundNumber} has no qualifying result to build a grid from — race the weekend instead`
      );
    }

    gridOrder = classificationOrder(qualifying);
  }

  const spec: RaceIniSpec = {
    mode,
    track,
    trackConfig,
    // Anything the round leaves to chance is drawn here, so race.ini only ever
    // carries settled conditions.
    race: rollRaceSpec(resolved.spec, weathers),
    player: toGridEntry(playerEntry, DEFAULT_AI_LEVEL, AI_AGGRESSION_MAX),
    opponents,
    gridOrder,
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
    group: group?.label,
    aiSeat,
    record,
  };
}
