import { promises as fs } from 'fs';
import path from 'path';
import { getChampionship } from '../race-data';
import { fallbackAiLevel, getDriverProfiles, resolvePlayerName } from '../driver-assets';
import {
  ChampionshipData,
  ChampionshipOpponent,
  ChampionshipRound,
  RaceSession,
  Season,
} from '../../types/race';
import { AC_CONTENT_TRACKS } from './paths';
import { GridEntry, LaunchMode, RaceIniSpec } from './race-ini';
import { readSeasonLineup, resolveAssists, resolveTraffic } from './assists';
import { readTrafficRoad } from './traffic-plan';
import { fieldOrder } from './field-order';
import { customModeFor, fieldFor } from '../traffic';
import { listWeathers, resolveRaceSpec, rollRaceSpec } from './race-spec';
import { AssistsConfig, AssistsSource } from '../../types/assists';
import { takesGridFromStandings } from '../../types/race-spec';
import { TrafficConfig, TrafficDecision, decideTrafficCars } from '../../types/traffic-preset';
import { TrafficFleetDecision, readTrafficFleets, resolveTrafficFleet } from './traffic-fleet';

// Aggression only shapes how an AI races the player — it does nothing AI-vs-AI —
// and above ~60 it turns into punts. The band is a style fallback for drivers
// whose profile doesn't set its own value.
const AI_AGGRESSION_MIN = 35;
const AI_AGGRESSION_MAX = 55;

/**
 * One batch of a round that is too big for its track.
 *
 * The groups of a round are raced one after another and classified together, so the
 * label is what ties them back into a single result — see `mergeGroupedRounds`.
 */
export interface LaunchGroup {
  /** Short and stable: "A", "B", "Over 1500cc". Shown on the round's results. */
  label: string;
  /**
   * How many batches the round was divided into, this one included. Recorded with
   * the result so the standings can tell a round that has finished from one that is
   * still going out — a round is not scored until every batch of it has run.
   */
  of?: number;
  /** Roster names racing in this batch. */
  drivers: string[];
}

export interface LaunchPlan {
  spec: RaceIniSpec;
  /** Game presets to write into cfg/assists.ini alongside race.ini. */
  assists: AssistsConfig;
  /** Whether the assists came from the season's own file or the global config. */
  assistsSource: AssistsSource;
  /**
   * How much traffic this round puts on the road, and where the number came from.
   * Only meaningful when `spec.customMode` is set: a round without it has no script
   * traffic to size, and the launcher leaves the mode's settings alone.
   */
  traffic?: TrafficDecision;
  /** The config that decision came from, filed against the season on first launch. */
  trafficConfig?: TrafficConfig;
  /**
   * Which traffic models the road gets, from `app/data/traffic-fleets.json`. Absent
   * when the table names no fleet for the track, in which case the mode runs every
   * installed model.
   */
  trafficFleet?: TrafficFleetDecision;
  championshipName: string;
  seasonNumber: number;
  seasonFolder: string;
  roundNumber: number;
  /** Track with its layout re-joined, matching how rounds are keyed elsewhere. */
  roundTrack: string;
  trackLabel: string;
  /** Set only when this launch is one batch of a round split across several. */
  group?: string;
  /** How many batches that round was divided into. Set alongside `group`. */
  groupCount?: number;
  /**
   * True when the round is run from a start to a finish somewhere else, and so is
   * raced without a qualifying — the grid came out of the championship table.
   */
  pointToPoint: boolean;
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

function randomAggression(): number {
  return (
    AI_AGGRESSION_MIN + Math.floor(Math.random() * (AI_AGGRESSION_MAX - AI_AGGRESSION_MIN + 1))
  );
}

function toGridEntry(
  opponent: ChampionshipOpponent,
  aiSkill: number,
  aiAggression: number
): GridEntry {
  return {
    car: opponent.car,
    skin: opponent.skin,
    name: opponent.name,
    nation: opponent.nation,
    // AC documents AI_LEVEL to 100; anything above it is handed to Il Direttore
    // through the grid manifest instead (see direttore-manifest.ts).
    aiLevel: Math.min(aiSkill, 100),
    aiSkill,
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

  // A round whose road carries its own CSP traffic fields no roster traffic: the
  // Fiats would be a second, worse set of it, and they would take pit boxes the
  // actual field needs.
  //
  // And the season's lineup takes out whoever it leaves at home -- never the player's
  // own entry, which a launch cannot do without.
  const seasonFolder = `season_${String(season.seasonNumber).padStart(2, '0')}`;
  const lineup = await readSeasonLineup(championship.folderName, seasonFolder);
  const excluded = new Set(lineup.excluded);
  const roster = fieldFor(data.opponents, round).filter(
    entry => entry === seasonEntry || !excluded.has(entry.name)
  );
  const field = group ? restrictToGroup(roster, group) : roster;

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
        profiles.get(entry.name)?.skill ?? fallbackAiLevel(entry.name),
        profiles.get(entry.name)?.aggression ?? randomAggression()
      )
    );

  const { track, trackConfig } = await resolveTrack(round.track);

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

  // A race on its own has no qualifying ahead of it to line the field up, so
  // something else has to.
  let gridOrder: string[] | undefined;
  const pointToPoint = resolved.spec.pointToPoint;
  const standingsGrid = takesGridFromStandings(resolved.spec);

  if (mode === 'race') {
    if (standingsGrid) {
      // Either the course cannot be qualified on, or the series has chosen not to.
      // Either way the championship table is the grid: leader on pole, down the table
      // from there, and the batch takes the slice of that order it is made of. It is
      // the same order the batches were seeded from, so Group A lines up in the order
      // it was drawn up.
      const { order } = fieldOrder(championship, season, roundNumber);
      const entered = new Set(field.map(entry => entry.name));

      gridOrder = order.filter(entry => entered.has(entry.name)).map(entry => entry.name);
    } else {
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
  }

  const spec: RaceIniSpec = {
    mode,
    track,
    trackConfig,
    // Anything the round leaves to chance is drawn here, so race.ini only ever
    // carries settled conditions.
    race: rollRaceSpec(resolved.spec, weathers),
    // When the seat is handed to the AI (a batch the player isn't entered in),
    // the stand-in races at their own rating like everyone else. AC ignores
    // these values while a human is driving CAR_0.
    player: toGridEntry(
      playerEntry,
      profiles.get(playerEntry.name)?.skill ?? fallbackAiLevel(playerEntry.name),
      profiles.get(playerEntry.name)?.aggression ?? randomAggression()
    ),
    opponents,
    gridOrder,
    customMode: customModeFor(round),
  };

  // Only a round handed to a traffic mode has script traffic to size. Measuring the
  // road is a file read, so it is not worth doing for the rest.
  let traffic: TrafficDecision | undefined;
  let trafficConfig: TrafficConfig | undefined;
  let trafficFleet: TrafficFleetDecision | undefined;
  if (spec.customMode) {
    trafficConfig = (await resolveTraffic(championship.folderName, seasonFolder)).traffic;
    traffic = decideTrafficCars(trafficConfig, await readTrafficRoad(track, trackConfig));
    trafficFleet = resolveTrafficFleet(await readTrafficFleets(), round.track) ?? undefined;
  }

  return {
    spec,
    assists,
    assistsSource,
    traffic,
    trafficConfig,
    trafficFleet,
    championshipName: championship.folderName,
    seasonNumber: season.seasonNumber,
    seasonFolder,
    roundNumber,
    roundTrack: round.track,
    trackLabel: trackConfig ? `${track} (${trackConfig})` : track,
    group: group?.label,
    groupCount: group?.of,
    pointToPoint,
    aiSeat,
    record,
  };
}
