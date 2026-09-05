import { promises as fs } from 'fs';
import path from 'path';
import {
  AssistsConfig,
  AssistsSource,
  DEFAULT_ASSISTS,
  sanitizeAssists,
} from '../../types/assists';
import { DEFAULT_TRAFFIC, TrafficConfig, sanitizeTraffic } from '../../types/traffic-preset';
import { DEFAULT_LINEUP, LineupConfig, sanitizeLineup } from '../../types/lineup-preset';

/**
 * Game presets resolve in two layers: a global config every launch uses by default,
 * and a per-season override. Each season's effective config is pinned into the data
 * folder on its first launch, so the archive keeps a record of the settings a season
 * was driven with even if the global config changes later.
 *
 * Three kinds live here. `assists` is the driving aids and realism settings AC reads from
 * cfg/assists.ini. `traffic` is how much traffic a road carries, which only a round run
 * in the Test Drive mode uses. `lineup` is which of the roster stays home, season-only.
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

async function writeConfigFile(
  target: string,
  patch: Record<string, unknown>
): Promise<void> {
  // Merge rather than replace. A presets file holds several independent preset kinds -
  // `assists`, `traffic`, and `grid`, the per-round cap on how many cars go out at once
  // - and rewriting the whole object would quietly delete the ones not being saved.
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse((await fs.readFile(target, 'utf8')).replace(/^﻿/, ''));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify({ ...existing, ...patch }, null, 2) + '\n', 'utf8');
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
  await writeConfigFile(GAME_CONFIG_FILE, { assists });
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
  await writeConfigFile(seasonAssistsPath(champFolder, seasonFolder), { assists });
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

/* ---------------------------------------------------------------- traffic presets */

async function readTrafficFile(target: string): Promise<TrafficConfig | null> {
  try {
    const contents = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(contents.replace(/^﻿/, '')) as { traffic?: unknown };
    // A file written before traffic existed has no key, and must not read as a config
    // of defaults - that would make every season look like it had pinned one.
    return parsed.traffic === undefined ? null : sanitizeTraffic(parsed.traffic);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
    return null;
  }
}

export async function readGlobalTraffic(): Promise<TrafficConfig> {
  return (await readTrafficFile(GAME_CONFIG_FILE)) ?? DEFAULT_TRAFFIC;
}

export async function writeGlobalTraffic(traffic: TrafficConfig): Promise<void> {
  await writeConfigFile(GAME_CONFIG_FILE, { traffic });
}

export async function readSeasonTraffic(
  champFolder: string,
  seasonFolder: string
): Promise<TrafficConfig | null> {
  return readTrafficFile(seasonAssistsPath(champFolder, seasonFolder));
}

export async function writeSeasonTraffic(
  champFolder: string,
  seasonFolder: string,
  traffic: TrafficConfig
): Promise<void> {
  await writeConfigFile(seasonAssistsPath(champFolder, seasonFolder), { traffic });
}

export interface ResolvedTraffic {
  traffic: TrafficConfig;
  source: AssistsSource;
}

/** The traffic config a launch of this season would use: its own, else the global one. */
export async function resolveTraffic(
  champFolder: string,
  seasonFolder: string
): Promise<ResolvedTraffic> {
  const season = await readSeasonTraffic(champFolder, seasonFolder);
  if (season) return { traffic: season, source: 'season' };

  return { traffic: await readGlobalTraffic(), source: 'global' };
}

/**
 * Record the traffic config a season is being driven with, on the same terms as the
 * assists: a season that already has one keeps it, one running on the global config
 * gets a copy filed away.
 */
export async function pinSeasonTraffic(
  champFolder: string,
  seasonFolder: string,
  traffic: TrafficConfig
): Promise<void> {
  const existing = await readSeasonTraffic(champFolder, seasonFolder);
  if (!existing) await writeSeasonTraffic(champFolder, seasonFolder, traffic);
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

/* ----------------------------------------------------------------- lineup presets */

/**
 * The drivers a season leaves at home. Season-only: a lineup is a list of this
 * season's names, so there is nothing global for it to fall back to. No file, or a file
 * without the key, is the whole roster.
 */
export async function readSeasonLineup(
  champFolder: string,
  seasonFolder: string
): Promise<LineupConfig> {
  try {
    const raw = await fs.readFile(seasonAssistsPath(champFolder, seasonFolder), 'utf8');
    const parsed = JSON.parse(raw.replace(/^﻿/, '')) as { lineup?: unknown };
    return parsed.lineup === undefined ? DEFAULT_LINEUP : sanitizeLineup(parsed.lineup);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error('Could not read the season lineup:', error);
    return DEFAULT_LINEUP;
  }
}

export async function writeSeasonLineup(
  champFolder: string,
  seasonFolder: string,
  lineup: LineupConfig
): Promise<void> {
  await writeConfigFile(seasonAssistsPath(champFolder, seasonFolder), { lineup });
}
