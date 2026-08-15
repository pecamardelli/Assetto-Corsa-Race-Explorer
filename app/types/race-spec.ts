/**
 * Everything a single round is raced with: distance, track conditions, session
 * lengths and the on-track rules. The .champ file only carries laps, a weather
 * index and a grip preset; the rest were constants in the race.ini writer until
 * this became editable. Client-safe — the filesystem side (resolving a round's
 * effective spec, saving an override) lives in lib/launch/race-spec.
 */

export interface GripPreset {
  name: string;
  sessionStart: number;
  randomness: number;
  lapGain: number;
  sessionTransfer: number;
}

/**
 * AC's track-grip presets. Values match the ones AC's own launcher writes; the
 * "green" row is verified against a real race.ini on this machine, and "optimum"
 * against the values the Street Rod launcher emits.
 */
export const GRIP_PRESETS: GripPreset[] = [
  { name: 'Dusty', sessionStart: 86, randomness: 2, lapGain: 30, sessionTransfer: 50 },
  { name: 'Old', sessionStart: 89, randomness: 3, lapGain: 50, sessionTransfer: 80 },
  { name: 'Slow', sessionStart: 96, randomness: 1, lapGain: 300, sessionTransfer: 80 },
  { name: 'Green', sessionStart: 95, randomness: 2, lapGain: 132, sessionTransfer: 0 },
  { name: 'Fast', sessionStart: 98, randomness: 2, lapGain: 700, sessionTransfer: 80 },
  { name: 'Optimum', sessionStart: 100, randomness: 0, lapGain: 1, sessionTransfer: 100 },
];

/** Where a grip index that is out of range lands. */
export const DEFAULT_GRIP = 3;

/**
 * Left in a saved spec, these two mean "decide at launch". Nothing rolls them
 * until a session is actually being written, so a round set to random gets fresh
 * conditions every time it is raced. No weather folder can be called this.
 */
export const RANDOM_WEATHER = '__random__';
export const RANDOM_GRIP = -1;

/** Wind is the one AC rolls itself, from this sentinel of its own. */
export const RANDOM_WIND_DIRECTION = -1;

/** Order matches AC's own launcher, so the index is what race.ini expects. */
export const JUMP_START_PENALTIES = ['None', 'Teleport to pits', 'Drive-through'];

/** AC's sun only travels between these two times, which is the SUN_ANGLE range. */
export const EARLIEST_TIME = 8 * 60;
export const LATEST_TIME = 18 * 60;

/** °C. The editor's sliders and the sanitiser work to the same ceilings. */
export const MAX_AMBIENT_TEMP = 40;
export const MAX_ROAD_TEMP = 60;
export const MAX_WIND_SPEED = 100;

/**
 * What one launch actually runs with: everything settled, nothing left to draw.
 * This is what race.ini is written from.
 */
export interface SettledRace {
  /** Race distance. Ignored by a free run, which never reaches the race session. */
  laps: number;
  /** Weather folder name, e.g. "4_mid_clear". */
  weather: string;
  /** Index into GRIP_PRESETS. */
  grip: number;
  /** °C. */
  ambientTemp: number;
  roadTemp: number;
  /** Minutes since midnight, 8:00–18:00. */
  timeOfDay: number;
  /** km/h. AC draws its own gusts between these two. */
  windSpeedMin: number;
  windSpeedMax: number;
  /** Compass degrees, or -1 for a random direction. */
  windDirection: number;
  /** 0 leaves a free run untimed, which is how it has always run. */
  practiceMinutes: number;
  /** A weekend always qualifies, so this never drops to zero. */
  qualifyingMinutes: number;
  penalties: boolean;
  /** Index into JUMP_START_PENALTIES. */
  jumpStartPenalty: number;
  /** Wheels off track before a lap is scrubbed; -1 never scrubs one. */
  tyresOut: number;
}

/**
 * What the user configures for a round. Weather and grip can be left to chance
 * outright; the conditions that come in degrees or hours are ranges instead, and
 * a range whose ends meet is simply a fixed value.
 */
export interface RaceSpec
  extends Omit<SettledRace, 'ambientTemp' | 'roadTemp' | 'timeOfDay'> {
  /**
   * A course run from a start to a finish somewhere else: a hillclimb, a stage, a
   * road down a coast. There is no lapping one, so there is no qualifying on one
   * either — the round goes straight to its race and takes its grid from the
   * championship table instead. Defaults to what the track's own tags say, and is
   * settled here for the rounds whose tags do not say it.
   *
   * Not part of SettledRace: it decides which sessions a launch runs, not what
   * goes into race.ini.
   */
  pointToPoint: boolean;
  /** Weather folder name, or RANDOM_WEATHER to draw one per launch. */
  weather: string;
  /** Index into GRIP_PRESETS, or RANDOM_GRIP to draw one per launch. */
  grip: number;
  /** °C, drawn between the two on each launch. */
  ambientTempFrom: number;
  ambientTempTo: number;
  roadTempFrom: number;
  roadTempTo: number;
  /** Minutes since midnight, drawn between the two on each launch. */
  timeOfDayFrom: number;
  timeOfDayTo: number;
}

/** Where a round's effective settings came from. */
export type RaceSpecSource = 'championship' | 'round';

/**
 * AC aims the sun with an angle rather than a clock: -80 is 8:00 and 80 is 18:00,
 * which puts noon at -16 — the value race.ini carried before time became editable.
 */
export function sunAngle(timeOfDay: number): number {
  return (timeOfDay / 60) * 16 - 208;
}

export function formatTimeOfDay(timeOfDay: number): string {
  const hours = Math.floor(timeOfDay / 60);
  const minutes = timeOfDay % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

/** "4_mid_clear" -> "Mid Clear". The prefix is only there to order the folders. */
export function weatherLabel(folder: string): string {
  if (folder === RANDOM_WEATHER) return 'Random weather';

  return folder
    .replace(/^\d+_/, '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function gripLabel(grip: number): string {
  if (grip === RANDOM_GRIP) return 'Random';

  return (GRIP_PRESETS[grip] ?? GRIP_PRESETS[DEFAULT_GRIP]).name;
}

/** How a round's grip reads in a listing, e.g. "Green track". */
export function trackConditionLabel(grip: number): string {
  return grip === RANDOM_GRIP ? 'Random grip' : `${gripLabel(grip)} track`;
}

export function jumpStartLabel(penalty: number): string {
  return JUMP_START_PENALTIES[penalty] ?? JUMP_START_PENALTIES[0];
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce anything read from disk or a request body into a complete spec, field by
 * field, so a saved file from an older version keeps the values it does know and
 * takes the rest from the round's own settings.
 */
export function sanitizeRaceSpec(input: unknown, base: RaceSpec): RaceSpec {
  const raw = (input ?? {}) as Record<string, unknown>;

  // Specs saved before a setting became a range carry the single value it had.
  const ambientTempFrom = clamp(
    raw.ambientTempFrom ?? raw.ambientTemp,
    base.ambientTempFrom,
    0,
    MAX_AMBIENT_TEMP
  );
  const roadTempFrom = clamp(
    raw.roadTempFrom ?? raw.roadTemp,
    base.roadTempFrom,
    0,
    MAX_ROAD_TEMP
  );
  const timeOfDayFrom = clamp(
    raw.timeOfDayFrom ?? raw.timeOfDay,
    base.timeOfDayFrom,
    EARLIEST_TIME,
    LATEST_TIME
  );
  const windSpeedMin = clamp(raw.windSpeedMin, base.windSpeedMin, 0, MAX_WIND_SPEED);

  // Every upper bound is held at or above its lower one, so nothing is ever drawn
  // from an inverted range. Math.max also covers a body that sent only the lower
  // one, where the fallback is the base spec's untouched upper bound.
  const upper = (value: unknown, fallback: number, from: number, max: number) =>
    Math.max(from, clamp(value, fallback, from, max));

  return {
    laps: clamp(raw.laps, base.laps, 1, 500),
    pointToPoint: bool(raw.pointToPoint, base.pointToPoint),
    weather: typeof raw.weather === 'string' && raw.weather ? raw.weather : base.weather,
    grip: clamp(raw.grip, base.grip, RANDOM_GRIP, GRIP_PRESETS.length - 1),
    ambientTempFrom,
    ambientTempTo: upper(
      raw.ambientTempTo ?? raw.ambientTemp,
      base.ambientTempTo,
      ambientTempFrom,
      MAX_AMBIENT_TEMP
    ),
    roadTempFrom,
    roadTempTo: upper(
      raw.roadTempTo ?? raw.roadTemp,
      base.roadTempTo,
      roadTempFrom,
      MAX_ROAD_TEMP
    ),
    timeOfDayFrom,
    timeOfDayTo: upper(
      raw.timeOfDayTo ?? raw.timeOfDay,
      base.timeOfDayTo,
      timeOfDayFrom,
      LATEST_TIME
    ),
    windSpeedMin,
    windSpeedMax: upper(raw.windSpeedMax, base.windSpeedMax, windSpeedMin, MAX_WIND_SPEED),
    windDirection: clamp(raw.windDirection, base.windDirection, -1, 359),
    practiceMinutes: clamp(raw.practiceMinutes, base.practiceMinutes, 0, 240),
    qualifyingMinutes: clamp(raw.qualifyingMinutes, base.qualifyingMinutes, 1, 240),
    penalties: bool(raw.penalties, base.penalties),
    jumpStartPenalty: clamp(
      raw.jumpStartPenalty,
      base.jumpStartPenalty,
      0,
      JUMP_START_PENALTIES.length - 1
    ),
    tyresOut: clamp(raw.tyresOut, base.tyresOut, -1, 4),
  };
}
