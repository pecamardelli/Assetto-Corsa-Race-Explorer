import { promises as fs } from 'fs';
import path from 'path';
import {
  AssistsConfig,
  AssistsSource,
  DEFAULT_ASSISTS,
  sanitizeAssists,
} from '../../types/assists';

/**
 * Game presets (driving aids and realism settings) resolve in two layers: a
 * global config every launch uses by default, and a per-season override. Each
 * season's effective config is pinned into the data folder on its first launch,
 * so the archive keeps a record of the settings a season was driven with even if
 * the global config changes later.
 */

const DATA_DIR = path.join(process.cwd(), 'app', 'data');

/** Global game presets. Holds an `assists` key so later preset kinds can join it. */
export const GAME_CONFIG_FILE = path.join(DATA_DIR, 'game-config.json');

/** ABS values 0/1/2 in the ini are off / per-car / forced on. */
const LEVEL_VALUES: Record<AssistsConfig['abs'], number> = { off: 0, factory: 1, on: 2 };

export function seasonAssistsPath(champFolder: string, seasonFolder: string): string {
  return path.join(DATA_DIR, 'championship', champFolder, `${seasonFolder}.presets.json`);
}

async function readConfigFile(target: string): Promise<AssistsConfig | null> {
  try {
    const contents = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(contents.replace(/^﻿/, '')) as { assists?: unknown };
    return sanitizeAssists(parsed.assists);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
    return null;
  }
}

async function writeConfigFile(target: string, assists: AssistsConfig): Promise<void> {
  // Merge rather than replace. A presets file holds an `assists` key so later preset
  // kinds can join it, and rewriting the whole object would quietly delete them -
  // `grid`, the per-round cap on how many cars go out at once, lives here too.
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse((await fs.readFile(target, 'utf8')).replace(/^﻿/, ''));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ ...existing, assists }, null, 2) + '\n', 'utf8');
}

/**
 * How many cars a given round of this season may send out at once, by round id.
 *
 * A track's pit box count is the hard ceiling but not always the sensible one:
 * Trento-Bondone has sixteen boxes and only the eight in its paddock stand far enough
 * apart for the biggest cars in a pre-war field. This is where a season says so.
 */
export async function readSeasonGridCaps(
  champFolder: string,
  seasonFolder: string
): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(seasonAssistsPath(champFolder, seasonFolder), 'utf8');
    const parsed = JSON.parse(raw.replace(/^﻿/, '')) as { grid?: unknown };
    if (!parsed.grid || typeof parsed.grid !== 'object') return {};

    const caps: Record<string, number> = {};
    for (const [track, value] of Object.entries(parsed.grid as Record<string, unknown>)) {
      const cars = Number(value);
      if (Number.isFinite(cars) && cars >= 2) caps[track] = Math.floor(cars);
    }
    return caps;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error('Could not read grid caps:', error);
    return {};
  }
}


export async function readGlobalAssists(): Promise<AssistsConfig> {
  return (await readConfigFile(GAME_CONFIG_FILE)) ?? DEFAULT_ASSISTS;
}

export async function writeGlobalAssists(assists: AssistsConfig): Promise<void> {
  await writeConfigFile(GAME_CONFIG_FILE, assists);
}

export async function readSeasonAssists(
  champFolder: string,
  seasonFolder: string
): Promise<AssistsConfig | null> {
  return readConfigFile(seasonAssistsPath(champFolder, seasonFolder));
}

export async function writeSeasonAssists(
  champFolder: string,
  seasonFolder: string,
  assists: AssistsConfig
): Promise<void> {
  await writeConfigFile(seasonAssistsPath(champFolder, seasonFolder), assists);
}

/** Drop a season's override so it follows the global config again. */
export async function deleteSeasonAssists(
  champFolder: string,
  seasonFolder: string
): Promise<void> {
  await fs.rm(seasonAssistsPath(champFolder, seasonFolder), { force: true });
}

export interface ResolvedAssists {
  assists: AssistsConfig;
  source: AssistsSource;
}

/** The config a launch of this season would use: its own file, else the global one. */
export async function resolveAssists(
  champFolder: string,
  seasonFolder: string
): Promise<ResolvedAssists> {
  const season = await readSeasonAssists(champFolder, seasonFolder);
  if (season) return { assists: season, source: 'season' };

  return { assists: await readGlobalAssists(), source: 'global' };
}

/**
 * Record the config a season is being driven with. A season that already has its
 * file keeps it untouched; one launching on the global config gets a copy of it,
 * which from then on is that season's own setting.
 */
export async function pinSeasonAssists(
  champFolder: string,
  seasonFolder: string,
  assists: AssistsConfig
): Promise<void> {
  const existing = await readSeasonAssists(champFolder, seasonFolder);
  if (!existing) await writeSeasonAssists(champFolder, seasonFolder, assists);
}

/** Render cfg/assists.ini, keys in the order AC's own launcher writes them. */
export function buildAssistsIni(assists: AssistsConfig): string {
  const rows: Array<[string, number]> = [
    ['IDEAL_LINE', assists.idealLine ? 1 : 0],
    ['AUTO_BLIP', assists.autoBlip ? 1 : 0],
    ['STABILITY_CONTROL', assists.stabilityControl],
    ['AUTO_BRAKE', assists.autoBrake ? 1 : 0],
    ['AUTO_SHIFTER', assists.autoShifter ? 1 : 0],
    ['ABS', LEVEL_VALUES[assists.abs]],
    ['TRACTION_CONTROL', LEVEL_VALUES[assists.tractionControl]],
    ['AUTO_CLUTCH', assists.autoClutch ? 1 : 0],
    ['VISUALDAMAGE', assists.visualDamage ? 100 : 0],
    ['DAMAGE', assists.damage],
    ['FUEL_RATE', assists.fuelRate],
    ['TYRE_WEAR', assists.tyreWear],
    ['TYRE_BLANKETS', assists.tyreBlankets ? 1 : 0],
    ['SLIPSTREAM', assists.slipstream],
  ];

  return ['[ASSISTS]', ...rows.map(([key, value]) => `${key}=${value}`), ''].join('\n');
}
