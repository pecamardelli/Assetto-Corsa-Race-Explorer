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
import { PlayerCarConfig, sanitizePlayerCar } from '../../types/player-car';

/**
 * Game presets resolve in two layers: a global config every launch uses by default,
 * and a per-season override. Each season's effective config is pinned into the data
 * folder on its first launch, so the archive keeps a record of the settings a season
 * was driven with even if the global config changes later.
 *
 * Five kinds live here. `assists` is the driving aids and realism settings AC reads from
 * cfg/assists.ini. `traffic` is how much traffic a road carries, which only a round run
 * in the Test Drive mode uses. `lineup` is which of the roster stays home, season-only,
 * and `car` is the car the player drives instead of the one the .champ entered them in,
 * season-only for the same reason. `players` is the same two again — a car and a set of
 * aids — but per person, for the seasons more than one of us drives.
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
 * Drop one preset kind from a file, leaving the others alone.
 *
 * The counterpart to the merge above: writing the key back as null would leave a file
 * saying the season had pinned nothing, which is a different thing from a season that
 * never pinned anything. A file with nothing left in it goes altogether.
 */
async function deleteConfigKey(target: string, key: string): Promise<void> {
  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse((await fs.readFile(target, 'utf8')).replace(/^﻿/, ''));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
    return;
  }

  if (!(key in existing)) return;
  delete existing[key];

  if (Object.keys(existing).length === 0) {
    await fs.rm(target, { force: true });
    return;
  }

  await fs.writeFile(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
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

/**
 * Drop a season's aids and traffic override so it follows the global config again.
 *
 * Only those two keys: the file also carries the season's lineup, its grid caps and
 * the seats of everyone who has driven it, none of which are settings the global
 * config has an answer for, and all of which would be lost with the file.
 */
export async function deleteSeasonAssists(
  champFolder: string,
  seasonFolder: string
): Promise<void> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  await deleteConfigKey(target, 'assists');
  await deleteConfigKey(target, 'traffic');
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

/* ------------------------------------------------------------- player car presets */

/**
 * Whose presets are being read or written.
 *
 * A season's car and its driving aids belong to the person driving it, not to the
 * season: two brothers going down the same coast road want their own cars and their
 * own aids, and a table showing one of them in the other's Testarossa would be
 * recording a race nobody drove. See `types/player.ts`.
 */
export interface PlayerScope {
  name: string;
  /**
   * True for the first player on the list. The season's own top-level `car` key
   * predates player profiles, so it is read as theirs — they were the only person
   * driving when it was saved — and moves under their name the next time they pick.
   */
  primary: boolean;
}

/** One player's own presets for one season. */
interface PlayerPresets {
  car?: PlayerCarConfig | null;
  assists?: AssistsConfig | null;
}

/** The whole `players` object of a presets file, as it sits on disk. */
async function readPlayerPresets(target: string): Promise<Record<string, PlayerPresets>> {
  try {
    const raw = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(raw.replace(/^﻿/, '')) as { players?: unknown };
    if (!parsed.players || typeof parsed.players !== 'object') return {};
    return parsed.players as Record<string, PlayerPresets>;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read presets file ${target}:`, error);
    return {};
  }
}

/** Merge one player's presets into the file, leaving every other player alone. */
async function writePlayerPresets(
  target: string,
  player: string,
  patch: PlayerPresets
): Promise<void> {
  const players = await readPlayerPresets(target);
  await writeConfigFile(target, {
    players: { ...players, [player]: { ...(players[player] ?? {}), ...patch } },
  });
}

/**
 * Drop one key from one player's presets.
 *
 * The player's own entry stays even when nothing is pinned to it any more: an entry
 * is what records that they have taken a seat in this season, which is what keeps
 * them off the grid when somebody else drives a round of it.
 */
async function deletePlayerPreset(
  target: string,
  player: string,
  key: keyof PlayerPresets
): Promise<void> {
  const players = await readPlayerPresets(target);
  const entry = players[player];
  if (!entry || !(key in entry)) return;

  const rest = { ...entry };
  delete rest[key];

  await writeConfigFile(target, { players: { ...players, [player]: rest } });
}

/**
 * Which players this season's presets have a seat for. Seating is also earned by
 * racing a round of it — `lib/season-players` puts the two together.
 */
export async function readSeasonPlayerNames(
  champFolder: string,
  seasonFolder: string
): Promise<string[]> {
  return Object.keys(await readPlayerPresets(seasonAssistsPath(champFolder, seasonFolder)));
}

/**
 * File a seat for a player in a season, so that from now on they are somebody who
 * drives it rather than a name on its roster. Called on their first launch.
 */
export async function seatSeasonPlayer(
  champFolder: string,
  seasonFolder: string,
  player: string
): Promise<void> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  const players = await readPlayerPresets(target);
  if (players[player]) return;

  await writeConfigFile(target, { players: { ...players, [player]: {} } });
}

/**
 * The car this season puts a player in, or null where it leaves them in the one the
 * .champ entered them in.
 *
 * Season-only, like the lineup: a car is a choice about one road trip, and there is
 * nothing global for it to fall back to. See `types/player-car.ts` for why a season
 * may override its own .champ at all, and `PlayerScope` for why the pick belongs to
 * the driver rather than to the season.
 */
export async function readSeasonPlayerCar(
  champFolder: string,
  seasonFolder: string,
  player: PlayerScope
): Promise<PlayerCarConfig | null> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  const own = sanitizePlayerCar((await readPlayerPresets(target))[player.name]?.car);
  if (own) return own;
  if (!player.primary) return null;

  // The pick the seasons already on file were driven with, saved before anyone else
  // drove here and so belonging to the one person who did.
  try {
    const raw = await fs.readFile(target, 'utf8');
    const parsed = JSON.parse(raw.replace(/^﻿/, '')) as { car?: unknown };
    return sanitizePlayerCar(parsed.car);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error("Could not read the season's player car:", error);
    return null;
  }
}

export async function writeSeasonPlayerCar(
  champFolder: string,
  seasonFolder: string,
  player: PlayerScope,
  car: PlayerCarConfig
): Promise<void> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  await writePlayerPresets(target, player.name, { car });

  // The primary's next pick carries the old season-wide key under their name, so from
  // then on there is exactly one place a car can come from.
  if (player.primary) await deleteConfigKey(target, 'car');
}

/** Drop the pick so this player follows the .champ again. */
export async function clearSeasonPlayerCar(
  champFolder: string,
  seasonFolder: string,
  player: PlayerScope
): Promise<void> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  await deletePlayerPreset(target, player.name, 'car');
  if (player.primary) await deleteConfigKey(target, 'car');
}

/**
 * The aids this player drives the season with, or null where they take the season's.
 *
 * Unlike the car, the season-wide `assists` key belongs to nobody in particular: it is
 * the record of the conditions the season is run under, pinned on its first launch,
 * and it goes on being the default for everyone who drives it. A player only appears
 * here once they have asked for something different.
 */
export async function readPlayerAssists(
  champFolder: string,
  seasonFolder: string,
  player: string
): Promise<AssistsConfig | null> {
  const target = seasonAssistsPath(champFolder, seasonFolder);
  const own = (await readPlayerPresets(target))[player]?.assists;
  return own ? sanitizeAssists(own) : null;
}

export async function writePlayerAssists(
  champFolder: string,
  seasonFolder: string,
  player: string,
  assists: AssistsConfig
): Promise<void> {
  await writePlayerPresets(seasonAssistsPath(champFolder, seasonFolder), player, { assists });
}

/** Drop this player's own aids so they drive the season's again. */
export async function clearPlayerAssists(
  champFolder: string,
  seasonFolder: string,
  player: string
): Promise<void> {
  await deletePlayerPreset(seasonAssistsPath(champFolder, seasonFolder), player, 'assists');
}

/**
 * The aids a launch of this season by this player would use: their own where they have
 * any, the season's otherwise, and the global config where the season has none either.
 */
export async function resolvePlayerAssists(
  champFolder: string,
  seasonFolder: string,
  player: string
): Promise<ResolvedAssists> {
  const own = await readPlayerAssists(champFolder, seasonFolder, player);
  if (own) return { assists: own, source: 'player' };

  return resolveAssists(champFolder, seasonFolder);
}
