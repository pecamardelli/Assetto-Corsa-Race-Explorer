import { promises as fs } from 'fs';
import path from 'path';
import { ChampionshipData, ChampionshipRound } from '../../types/race';
import {
  GRIP_PRESETS,
  RANDOM_GRIP,
  RANDOM_WEATHER,
  RANDOM_WIND_DIRECTION,
  RaceSpec,
  RaceSpecSource,
  SettledRace,
  sanitizeRaceSpec,
} from '../../types/race-spec';
import { AC_CONTENT_WEATHER } from './paths';
import { isPointToPointTrack } from '../track-data';

/**
 * Per-round race settings resolve in two layers: the .champ file the championship
 * was imported with, and an override the editor writes next to it. The .champ is
 * never rewritten — it belongs to Content Manager — so a round the user has not
 * touched keeps following the championship, which leaves the skies to chance.
 */

const DATA_DIR = path.join(process.cwd(), 'app', 'data');

/** Falls back to the folder AC ships when the weather list cannot be read. */
const DEFAULT_WEATHER = '3_clear';

/** Used when a .champ carries no qualifying length of its own. */
const DEFAULT_QUALIFYING_MINUTES = 15;

// The values race.ini was written with before these became editable, so a round
// with no override launches much as it always did.
const DEFAULT_TIME_OF_DAY = 12 * 60;
const DEFAULT_AMBIENT_TEMP = 20;
const DEFAULT_ROAD_TEMP = 26;
const DEFAULT_WIND_SPEED_MIN = 0;
const DEFAULT_WIND_SPEED_MAX = 10;
const DEFAULT_TYRES_OUT = -1;

/** One file per season, keyed by round number. */
interface RaceSpecFile {
  rounds: Record<string, unknown>;
}

export function seasonRaceSpecPath(champFolder: string, seasonFolder: string): string {
  return path.join(DATA_DIR, 'championship', champFolder, `${seasonFolder}.races.json`);
}

/**
 * Weather AC ships that a race is never run in. Heavy fog leaves the AI blind and
 * the track barely raceable, so it is kept out of both the picker and the draw.
 */
const EXCLUDED_WEATHERS = new Set(['1_heavy_fog']);

/**
 * Weather folders AC has installed, in the order it lists them — which is by
 * folder name, and why they all carry a numeric prefix. Anything in
 * EXCLUDED_WEATHERS is dropped, so it can neither be picked nor drawn.
 */
export async function listWeathers(): Promise<string[]> {
  try {
    const entries = await fs.readdir(AC_CONTENT_WEATHER, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .filter(name => !EXCLUDED_WEATHERS.has(name))
      .sort();

    return folders.length ? folders : [DEFAULT_WEATHER];
  } catch {
    return [DEFAULT_WEATHER];
  }
}

/** Map a .champ round's weather index onto an installed folder. */
export function weatherAt(weathers: string[], index: number): string {
  return weathers[index] ?? weathers[0] ?? DEFAULT_WEATHER;
}

/** Uniform over whole steps from `from` up to `to`, both ends included. */
function between(from: number, to: number, step = 1): number {
  if (to <= from) return from;

  const steps = Math.floor((to - from) / step);
  return from + Math.floor(Math.random() * (steps + 1)) * step;
}

/** Time of day is drawn in ten-minute steps, the granularity the editor offers. */
const TIME_STEP_MINUTES = 10;

/**
 * Settle whatever a round left to chance. Called once per launch rather than when
 * the settings are saved, so a round set to random conditions draws again every
 * time it is raced — including the second running of a weekend's own round.
 */
export function rollRaceSpec(spec: RaceSpec, weathers: string[]): SettledRace {
  const {
    ambientTempFrom,
    ambientTempTo,
    roadTempFrom,
    roadTempTo,
    timeOfDayFrom,
    timeOfDayTo,
    pointToPoint,
    ...rest
  } = spec;

  // Whether the round qualifies at all decides which sessions a launch runs, not
  // what goes into race.ini, so it is dropped here rather than settled.
  void pointToPoint;

  return {
    ...rest,
    weather:
      spec.weather === RANDOM_WEATHER
        ? weatherAt(weathers, Math.floor(Math.random() * weathers.length))
        : spec.weather,
    grip:
      spec.grip === RANDOM_GRIP
        ? Math.floor(Math.random() * GRIP_PRESETS.length)
        : spec.grip,
    ambientTemp: between(ambientTempFrom, ambientTempTo),
    roadTemp: between(roadTempFrom, roadTempTo),
    timeOfDay: between(timeOfDayFrom, timeOfDayTo, TIME_STEP_MINUTES),
  };
}

/**
 * What a round is raced with when nothing has been edited: distance and rules
 * out of the .champ, and skies left to chance.
 *
 * The .champ pins a weather and a grip preset per round, but a series is more
 * interesting when neither is known in advance, so both default to a draw. The
 * round's own values are still there in the file for anyone who wants to set
 * them back by hand in the editor.
 */
export function championshipSpec(
  round: ChampionshipRound,
  data: ChampionshipData
): RaceSpec {
  return {
    laps: round.laps,
    // What the track's own tags say it is. A round whose track is tagged as a
    // circuit but raced as a stage — the Targa Florio cuts, say — is set straight
    // in the round's own settings.
    pointToPoint: isPointToPointTrack(round.track),
    weather: RANDOM_WEATHER,
    grip: RANDOM_GRIP,
    // Ranges whose ends meet, so temperature and time are not left to chance.
    ambientTempFrom: DEFAULT_AMBIENT_TEMP,
    ambientTempTo: DEFAULT_AMBIENT_TEMP,
    roadTempFrom: DEFAULT_ROAD_TEMP,
    roadTempTo: DEFAULT_ROAD_TEMP,
    timeOfDayFrom: DEFAULT_TIME_OF_DAY,
    timeOfDayTo: DEFAULT_TIME_OF_DAY,
    windSpeedMin: DEFAULT_WIND_SPEED_MIN,
    windSpeedMax: DEFAULT_WIND_SPEED_MAX,
    windDirection: RANDOM_WIND_DIRECTION,
    practiceMinutes: data.rules.practice ?? 0,
    qualifyingMinutes: data.rules.qualifying || DEFAULT_QUALIFYING_MINUTES,
    penalties: data.rules.penalties,
    jumpStartPenalty: data.rules.jumpstart ?? 0,
    tyresOut: DEFAULT_TYRES_OUT,
  };
}

/**
 * One season's .champ file. The season pages come at this through race-data, which
 * walks every result file with it; an editor only needs the championship itself.
 */
export async function readSeasonChampionship(
  champFolder: string,
  seasonFolder: string
): Promise<ChampionshipData | null> {
  const target = path.join(DATA_DIR, 'championship', champFolder, `${seasonFolder}.champ`);

  try {
    const contents = await fs.readFile(target, 'utf8');
    return JSON.parse(contents.replace(/^﻿/, '')) as ChampionshipData;
  } catch (error) {
    console.error(`Could not read .champ file ${target}:`, error);
    return null;
  }
}

async function readSpecFile(champFolder: string, seasonFolder: string): Promise<RaceSpecFile> {
  const target = seasonRaceSpecPath(champFolder, seasonFolder);

  try {
    const contents = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(contents.replace(/^﻿/, '')) as Partial<RaceSpecFile>;
    return { rounds: (parsed.rounds ?? {}) as Record<string, unknown> };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read race specs file ${target}:`, error);
    return { rounds: {} };
  }
}

async function writeSpecFile(
  champFolder: string,
  seasonFolder: string,
  file: RaceSpecFile
): Promise<void> {
  const target = seasonRaceSpecPath(champFolder, seasonFolder);

  // Nothing left to override: drop the file rather than leave an empty one behind.
  if (Object.keys(file.rounds).length === 0) {
    await fs.rm(target, { force: true });
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(file, null, 2) + '\n', 'utf8');
}

export interface ResolvedRaceSpec {
  spec: RaceSpec;
  /** What the round would run with if its override were dropped. */
  championship: RaceSpec;
  source: RaceSpecSource;
}

/** The settings a launch of this round would use, override included. */
export async function resolveRaceSpec(
  champFolder: string,
  seasonFolder: string,
  data: ChampionshipData,
  roundNumber: number
): Promise<ResolvedRaceSpec | null> {
  const round = data.rounds[roundNumber - 1];
  if (!round) return null;

  const base = championshipSpec(round, data);
  const file = await readSpecFile(champFolder, seasonFolder);
  const override = file.rounds[String(roundNumber)];

  if (!override) return { spec: base, championship: base, source: 'championship' };

  return { spec: sanitizeRaceSpec(override, base), championship: base, source: 'round' };
}

/** Every round's effective settings in one pass, for listing a whole season. */
export async function resolveSeasonRaceSpecs(
  champFolder: string,
  seasonFolder: string,
  data: ChampionshipData
): Promise<RaceSpec[]> {
  const file = await readSpecFile(champFolder, seasonFolder);

  return data.rounds.map((round, index) => {
    const base = championshipSpec(round, data);
    const override = file.rounds[String(index + 1)];
    return override ? sanitizeRaceSpec(override, base) : base;
  });
}

export async function writeRaceSpec(
  champFolder: string,
  seasonFolder: string,
  roundNumber: number,
  spec: RaceSpec
): Promise<void> {
  const file = await readSpecFile(champFolder, seasonFolder);
  file.rounds[String(roundNumber)] = spec;
  await writeSpecFile(champFolder, seasonFolder, file);
}

/** Drop a round's override so it follows the championship file again. */
export async function deleteRaceSpec(
  champFolder: string,
  seasonFolder: string,
  roundNumber: number
): Promise<void> {
  const file = await readSpecFile(champFolder, seasonFolder);
  delete file.rounds[String(roundNumber)];
  await writeSpecFile(champFolder, seasonFolder, file);
}
