import { nationName } from './nations';

export type LaunchMode = 'weekend' | 'freerun';

export type SessionType = 'practice' | 'qualifying' | 'race';

export const LAUNCH_MODES: LaunchMode[] = ['weekend', 'freerun'];

/**
 * The sessions each mode runs, in order. A weekend qualifies and then races, which
 * lets AC build the grid from its own qualifying result instead of us reconstructing
 * one from a previous session's JSON.
 */
export const MODE_SESSIONS: Record<LaunchMode, SessionType[]> = {
  weekend: ['qualifying', 'race'],
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
  laps: number;
  qualifyingMinutes: number;
  penalties: boolean;
  jumpStartPenalty: number;
  /** Weather folder name, e.g. "4_mid_clear". */
  weather: string;
  /** Grip preset index from the .champ round (0 dusty … 5 optimum). */
  grip: number;
  player: GridEntry;
  /** AI opponents. Ignored for a free run. */
  opponents: GridEntry[];
}

/**
 * AC's track-grip presets. Values match the ones AC's own launcher writes; the
 * "green" row is verified against a real race.ini on this machine, and "optimum"
 * against the values the Street Rod launcher emits.
 */
const GRIP_PRESETS = [
  { name: 'Dusty', sessionStart: 86, randomness: 2, lapGain: 30, sessionTransfer: 50 },
  { name: 'Old', sessionStart: 89, randomness: 3, lapGain: 50, sessionTransfer: 80 },
  { name: 'Slow', sessionStart: 96, randomness: 1, lapGain: 300, sessionTransfer: 80 },
  { name: 'Green', sessionStart: 95, randomness: 2, lapGain: 132, sessionTransfer: 0 },
  { name: 'Fast', sessionStart: 98, randomness: 2, lapGain: 700, sessionTransfer: 80 },
  { name: 'Optimum', sessionStart: 100, randomness: 0, lapGain: 1, sessionTransfer: 100 },
];

/** AC session TYPE values used in [SESSION_n]. */
const SESSION_TYPE_IDS: Record<SessionType, number> = { practice: 1, qualifying: 2, race: 3 };

const SESSION_NAMES: Record<SessionType, string> = {
  practice: 'Free Run',
  qualifying: 'Qualifying',
  race: 'Race',
};

// Not carried by the .champ format, so they are constants rather than settings.
// Tweak here if the series wants a different time of day or ambient temperature.
const SUN_ANGLE = '-16.00';
const AMBIENT_TEMP = 20;
const ROAD_TEMP = 26;

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

/**
 * Render a complete race.ini for one launch, which may hold several sessions.
 *
 * Entry order carries no weight here: a weekend's race grid comes out of its own
 * qualifying session, so the player simply takes CAR_0.
 */
export function buildRaceIni(spec: RaceIniSpec): string {
  const grip = GRIP_PRESETS[spec.grip] ?? GRIP_PRESETS[3];
  const sessions = MODE_SESSIONS[spec.mode];

  // A free run is the player alone on track.
  const opponents = spec.mode === 'freerun' ? [] : spec.opponents;

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
      ['PRESET', spec.grip],
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

  chunks.push(section('LAP_INVALIDATOR', [['ALLOWED_TYRES_OUT', -1]]));

  chunks.push(
    section('LIGHTING', [
      ['CLOUD_SPEED', '0.200'],
      ['SUN_ANGLE', SUN_ANGLE],
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
      ['JUMP_START_PENALTY', spec.jumpStartPenalty],
      ['MODEL', spec.player.car],
      ['MODEL_CONFIG', ''],
      ['PENALTIES', spec.penalties ? 1 : 0],
      ['RACE_LAPS', sessions.includes('race') ? spec.laps : 0],
      ['SKIN', spec.player.skin],
      ['TRACK', spec.track],
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
      ['AMBIENT', AMBIENT_TEMP],
      ['ROAD', ROAD_TEMP],
    ])
  );

  chunks.push(section('WEATHER', [['NAME', spec.weather]]));

  chunks.push(
    section('WIND', [
      ['DIRECTION_DEG', -1],
      ['SPEED_KMH_MAX', 10],
      ['SPEED_KMH_MIN', 0],
    ])
  );

  chunks.push(section('__PREVIEW_GENERATION', [['ACTIVE', 0]]));

  sessions.forEach((sessionType, index) => {
    const rows: Array<[string, string | number]> = [
      ['NAME', SESSION_NAMES[sessionType]],
      ['TYPE', SESSION_TYPE_IDS[sessionType]],
    ];

    if (sessionType === 'race') {
      rows.push(['LAPS', spec.laps], ['DURATION_MINUTES', 0]);
    } else if (sessionType === 'qualifying') {
      rows.push(['DURATION_MINUTES', spec.qualifyingMinutes]);
    } else {
      // 0 minutes is AC's "no time limit" for a practice session.
      rows.push(['DURATION_MINUTES', 0]);
    }

    rows.push(['SPAWN_SET', sessionType === 'race' ? 'START' : 'PIT']);

    chunks.push(section(`SESSION_${index}`, rows));
  });

  grid.forEach(({ entry, isPlayer }, index) => {
    chunks.push(carSection(index, entry, isPlayer));
  });

  return chunks.join('\n');
}
