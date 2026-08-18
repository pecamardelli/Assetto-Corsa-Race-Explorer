import { DEFAULT_GRIP, GRIP_PRESETS, SettledRace, sunAngle } from '../../types/race-spec';
import { nationName } from './nations';

export type LaunchMode = 'weekend' | 'race' | 'freerun';

export type SessionType = 'practice' | 'qualifying' | 'race';

export const LAUNCH_MODES: LaunchMode[] = ['weekend', 'race', 'freerun'];

/**
 * The sessions each mode runs, in order. A weekend qualifies and then races, which
 * lets AC build the grid from its own qualifying result instead of us reconstructing
 * one from a previous session's JSON.
 *
 * `race` is for the round whose qualifying is already on the books: it runs the race
 * alone, and the grid it would otherwise have inherited is handed to it through
 * `RaceIniSpec.gridOrder`.
 */
export const MODE_SESSIONS: Record<LaunchMode, SessionType[]> = {
  weekend: ['qualifying', 'race'],
  race: ['race'],
  freerun: ['practice'],
};

export interface GridEntry {
  car: string;
  skin: string;
  name: string;
  /** Three-letter code straight from the .champ file. */
  nation: string;
  aiLevel: number;
  aiAggression: number;
}

export interface RaceIniSpec {
  mode: LaunchMode;
  /** Track folder name, with the layout split off into trackConfig. */
  track: string;
  trackConfig: string;
  /** Distance, conditions, session lengths and rules this launch settled on. */
  race: SettledRace;
  player: GridEntry;
  /** AI opponents. Ignored for a free run. */
  opponents: GridEntry[];
  /**
   * Driver names in grid order, pole first. Only set for a race launched on its own,
   * which has no qualifying of its own to line the field up from.
   */
  gridOrder?: string[];
  /**
   * A Custom Shaders Patch mode to race in, by folder name, or undefined for a plain
   * Assetto Corsa race. Content Manager selects these through `__CM_CUSTOM_MODE` in
   * `[RACE]`, and AC itself ignores the key, so writing it costs nothing on a machine
   * without the mode installed — the round simply runs as an ordinary race.
   */
  customMode?: string;
}

/** AC session TYPE values used in [SESSION_n]. */
const SESSION_TYPE_IDS: Record<SessionType, number> = { practice: 1, qualifying: 2, race: 3 };

const SESSION_NAMES: Record<SessionType, string> = {
  practice: 'Free Run',
  qualifying: 'Qualifying',
  race: 'Race',
};

function section(name: string, entries: Array<[string, string | number]>): string {
  return [`[${name}]`, ...entries.map(([k, v]) => `${k}=${v}`), ''].join('\n');
}

function carSection(index: number, entry: GridEntry, isPlayer: boolean): string {
  const rows: Array<[string, string | number]> = [
    // "-" tells AC this slot is the player, taking its model from [RACE].
    ['MODEL', isPlayer ? '-' : entry.car],
    ['MODEL_CONFIG', ''],
  ];

  if (!isPlayer) {
    rows.push(['AI_LEVEL', entry.aiLevel], ['AI_AGGRESSION', entry.aiAggression]);
  }

  rows.push(
    ['SKIN', entry.skin],
    ['DRIVER_NAME', entry.name],
    ['NATIONALITY', nationName(entry.nation)],
    ['NATION_CODE', entry.nation]
  );

  return section(`CAR_${index}`, rows);
}

/** Where the field starts when a recorded qualifying is standing in for a live one. */
interface StartingGrid {
  /** Opponents in qualifying order, filling CAR_1 upwards. */
  opponents: GridEntry[];
  /** The player's own slot, counting from 1. */
  playerPosition: number;
}

/**
 * Rebuild a grid from a qualifying that was run earlier.
 *
 * AC always reads CAR_0 as the player, so the field is expressed the way Content
 * Manager expresses it: the AI fill CAR_1 upwards in the order they qualified, and
 * the player is dropped in among them by [SESSION_n] STARTING_POSITION. A weekend
 * needs none of this — it races off its own qualifying result and grids itself.
 *
 * Counting who is actually ahead of the player, rather than reading their qualifying
 * position off directly, keeps the grid honest when the roster has moved on since:
 * a driver who has left the season no longer holds a slot in front of anybody.
 */
function rebuildGrid(
  opponents: GridEntry[],
  playerName: string,
  gridOrder: string[]
): StartingGrid {
  const rank = new Map(gridOrder.map((name, index) => [name, index]));

  // Anyone the qualifying never classified sorts to the back, and a stable sort
  // leaves them there in roster order.
  const unclassified = Number.MAX_SAFE_INTEGER;
  const place = (entry: GridEntry) => rank.get(entry.name) ?? unclassified;

  const sorted = [...opponents].sort((a, b) => place(a) - place(b));
  const playerPlace = rank.get(playerName) ?? unclassified;

  return {
    opponents: sorted,
    playerPosition: sorted.filter(entry => place(entry) < playerPlace).length + 1,
  };
}

/**
 * Render a complete race.ini for one launch, which may hold several sessions.
 */
export function buildRaceIni(spec: RaceIniSpec): string {
  const race = spec.race;
  const grip = GRIP_PRESETS[race.grip] ?? GRIP_PRESETS[DEFAULT_GRIP];
  const sessions = MODE_SESSIONS[spec.mode];

  // A free run is the player alone on track.
  const entered = spec.mode === 'freerun' ? [] : spec.opponents;

  const startingGrid = spec.gridOrder?.length
    ? rebuildGrid(entered, spec.player.name, spec.gridOrder)
    : null;

  const opponents = startingGrid ? startingGrid.opponents : entered;

  const grid: Array<{ entry: GridEntry; isPlayer: boolean }> = [
    { entry: spec.player, isPlayer: true },
    ...opponents.map(entry => ({ entry, isPlayer: false })),
  ];

  const chunks: string[] = [];

  chunks.push(section('BENCHMARK', [['ACTIVE', 0]]));

  chunks.push(
    section('DYNAMIC_TRACK', [
      ['LAP_GAIN', grip.lapGain],
      ['RANDOMNESS', grip.randomness],
      ['SESSION_START', grip.sessionStart],
      ['SESSION_TRANSFER', grip.sessionTransfer],
      ['PRESET', race.grip],
    ])
  );

  chunks.push(
    section('GHOST_CAR', [
      ['ENABLED', 0],
      ['FILE', ''],
      ['LOAD', 0],
      ['PLAYING', 0],
      ['RECORDING', 0],
      ['SECONDS_ADVANTAGE', 0],
    ])
  );

  chunks.push(
    section('GROOVE', [
      ['VIRTUAL_LAPS', 10],
      ['MAX_LAPS', 30],
      ['STARTING_LAPS', 0],
    ])
  );

  chunks.push(section('HEADER', [['VERSION', 1]]));

  chunks.push(section('LAP_INVALIDATOR', [['ALLOWED_TYRES_OUT', race.tyresOut]]));

  chunks.push(
    section('LIGHTING', [
      ['CLOUD_SPEED', '0.200'],
      ['SUN_ANGLE', sunAngle(race.timeOfDay).toFixed(2)],
      ['TIME_MULT', '1.0'],
    ])
  );

  chunks.push(section('OPTIONS', [['USE_MPH', 0]]));

  chunks.push(
    section('RACE', [
      ['AI_LEVEL', 100],
      ['CARS', grid.length],
      ['CONFIG_TRACK', spec.trackConfig],
      ['DRIFT_MODE', 0],
      ['FIXED_SETUP', 0],
      ['JUMP_START_PENALTY', race.jumpStartPenalty],
      ['MODEL', spec.player.car],
      ['MODEL_CONFIG', ''],
      ['PENALTIES', race.penalties ? 1 : 0],
      ['RACE_LAPS', sessions.includes('race') ? race.laps : 0],
      ['SKIN', spec.player.skin],
      ['TRACK', spec.track],
      ...(spec.customMode ? [['__CM_CUSTOM_MODE', spec.customMode] as [string, string]] : []),
    ])
  );

  chunks.push(
    section('REMOTE', [
      ['ACTIVE', 0],
      ['GUID', ''],
      ['NAME', ''],
      ['PASSWORD', ''],
      ['REQUESTED_CAR', ''],
      ['SERVER_IP', ''],
      ['SERVER_PORT', ''],
      ['TEAM', ''],
    ])
  );

  chunks.push(
    section('REPLAY', [
      ['ACTIVE', 0],
      ['FILENAME', ''],
    ])
  );

  chunks.push(section('RESTART', [['ACTIVE', 0]]));

  chunks.push(
    section('TEMPERATURE', [
      ['AMBIENT', race.ambientTemp],
      ['ROAD', race.roadTemp],
    ])
  );

  chunks.push(section('WEATHER', [['NAME', race.weather]]));

  chunks.push(
    section('WIND', [
      ['DIRECTION_DEG', race.windDirection],
      ['SPEED_KMH_MAX', race.windSpeedMax],
      ['SPEED_KMH_MIN', race.windSpeedMin],
    ])
  );

  chunks.push(section('__PREVIEW_GENERATION', [['ACTIVE', 0]]));

  sessions.forEach((sessionType, index) => {
    const rows: Array<[string, string | number]> = [
      ['NAME', SESSION_NAMES[sessionType]],
      ['TYPE', SESSION_TYPE_IDS[sessionType]],
    ];

    if (sessionType === 'race') {
      rows.push(['LAPS', race.laps], ['DURATION_MINUTES', 0]);

      // Only ever written for a race standing on its own — a weekend grids itself
      // off the qualifying it just ran, and would ignore this anyway.
      if (startingGrid) rows.push(['STARTING_POSITION', startingGrid.playerPosition]);
    } else if (sessionType === 'qualifying') {
      rows.push(['DURATION_MINUTES', race.qualifyingMinutes]);
    } else {
      // 0 minutes is AC's "no time limit" for a practice session.
      rows.push(['DURATION_MINUTES', race.practiceMinutes]);
    }

    rows.push(['SPAWN_SET', sessionType === 'race' ? 'START' : 'PIT']);

    chunks.push(section(`SESSION_${index}`, rows));
  });

  grid.forEach(({ entry, isPlayer }, index) => {
    chunks.push(carSection(index, entry, isPlayer));
  });

  return chunks.join('\n');
}
