import { promises as fs } from 'fs';
import path from 'path';
import { AC_CONTENT_CARS } from './paths';
import {
  InstalledCar,
  InstalledSkin,
  carKind,
  drivetrainOf,
  parseBhp,
  parseTopSpeedKmh,
  parseWeightKg,
} from '../../types/installed-car';

/**
 * Reading the cars out of the Assetto Corsa install.
 *
 * `app/data/cars` holds one JSON per car that some championship has already used — it is
 * an archive of what has been raced, copied over by `scripts/copy-car-data.js`, and it
 * is deliberately not a catalogue: a car nobody has entered yet is simply not in it. To
 * offer a car that has never been driven, the install itself has to be read, which is
 * what this does.
 *
 * The whole scan is around 350 folders and takes a fifth of a second on this machine, so
 * it is done in one pass and kept, rather than sampled per request. The install changes
 * when a mod is installed and not otherwise, so the cache is held for a few minutes and
 * can be dropped outright — a car added while the app is up shows up on the next scan
 * rather than needing a restart.
 */

/** Long enough that a page of the picker never rescans, short enough to notice a mod. */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface Cached {
  cars: InstalledCar[];
  at: number;
}

let cache: Cached | null = null;

/**
 * Parse a file AC or a mod author wrote, which is JSON only by intention.
 *
 * Three things go wrong in practice and all three are recoverable: a UTF-8 BOM, raw tabs
 * and newlines inside string values (every car with a multi-paragraph description has
 * them), and a trailing comma before a closing brace. Anything else is a real syntax
 * error and the car is skipped.
 */
function parseAcJson<T>(raw: string): T | null {
  const escaped = raw
    .replace(/^﻿/, '')
    // Only inside quoted strings: a tab between two keys is whitespace and legal.
    .replace(/("(?:[^"\\]|\\.)*")/g, match =>
      match.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    );

  try {
    return JSON.parse(escaped) as T;
  } catch {
    try {
      return JSON.parse(escaped.replace(/,(\s*[}\]])/g, '$1')) as T;
    } catch {
      return null;
    }
  }
}

async function readAcJson<T>(file: string): Promise<T | null> {
  try {
    return parseAcJson<T>(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

interface UiCar {
  name?: unknown;
  brand?: unknown;
  class?: unknown;
  year?: unknown;
  tags?: unknown;
  specs?: unknown;
  description?: unknown;
}

/** Everything in ui_car.json is written by hand, so nothing in it is trusted to be a string. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function specs(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [key, spec] of Object.entries(value as Record<string, unknown>)) {
    // `range` is a bare number in most cars and a string in a few; both display.
    if (typeof spec === 'string' && spec.trim()) out[key] = spec.trim();
    else if (typeof spec === 'number' && Number.isFinite(spec)) out[key] = String(spec);
  }
  return out;
}

function year(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(text(value));
  return Number.isFinite(parsed) && parsed > 1800 && parsed < 2200 ? Math.round(parsed) : null;
}

/**
 * The skin folders of a car, in the order AC lists them — which is the order the
 * filesystem gives, and why the stock cars number their default livery `00_` or `0_`.
 */
async function skinFolders(carDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(path.join(carDir, 'skins'), { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Turn one content/cars folder into a catalogue entry, or null if it holds no car. */
async function readCar(id: string): Promise<InstalledCar | null> {
  const carDir = path.join(AC_CONTENT_CARS, id);
  const ui = await readAcJson<UiCar>(path.join(carDir, 'ui', 'ui_car.json'));
  if (!ui) return null;

  const tags = Array.isArray(ui.tags)
    ? ui.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    : [];
  const carClass = text(ui.class);
  const carSpecs = specs(ui.specs);
  const skins = await skinFolders(carDir);

  return {
    id,
    // A car with no name of its own is listed under its folder rather than blank.
    name: text(ui.name) || id,
    brand: text(ui.brand) || 'Unknown',
    carClass,
    year: year(ui.year),
    tags,
    specs: carSpecs,
    bhp: parseBhp(carSpecs),
    weightKg: parseWeightKg(carSpecs),
    topSpeedKmh: parseTopSpeedKmh(carSpecs),
    drivetrain: drivetrainOf(tags),
    kind: carKind(carClass, tags),
    skinCount: skins.length,
    defaultSkin: skins[0] ?? '',
  };
}

/**
 * Every car installed, sorted by brand then name — which is how a picker reads and how
 * AC's own car list is ordered.
 *
 * An install that cannot be reached comes back empty rather than throwing: the app is
 * meant to build and run on a box without the game on it, and a picker with nothing in
 * it says that plainly.
 */
export async function readInstalledCars(): Promise<InstalledCar[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.cars;

  let entries;
  try {
    entries = await fs.readdir(AC_CONTENT_CARS, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error(`Could not read ${AC_CONTENT_CARS}:`, error);
    return [];
  }

  const folders = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
  const scanned = await Promise.all(folders.map(readCar));
  const cars = scanned
    .filter((car): car is InstalledCar => car !== null)
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));

  cache = { cars, at: Date.now() };
  return cars;
}

/** Drop the cached scan, so the next read picks up a car installed since. */
export function forgetInstalledCars(): void {
  cache = null;
}

export async function readInstalledCar(id: string): Promise<InstalledCar | null> {
  if (!isSafeSegment(id)) return null;
  return (await readInstalledCars()).find(car => car.id === id) ?? null;
}

interface UiSkin {
  skinname?: unknown;
}

/**
 * A car's liveries, with the names their ui_skin.json gives them.
 *
 * Kept out of the catalogue on purpose: an install has ten times as many skins as cars,
 * and a picker only ever needs the liveries of the one car being looked at. Reading them
 * per car keeps the list the browser is handed to the cars themselves.
 *
 * A skin with no name of its own is listed under its folder, which is usually readable
 * enough ("rosso_siviglia") and is in any case what AC would show.
 */
export async function readCarSkins(id: string): Promise<InstalledSkin[]> {
  if (!isSafeSegment(id)) return [];

  const carDir = path.join(AC_CONTENT_CARS, id);
  const folders = await skinFolders(carDir);

  return Promise.all(
    folders.map(async skin => {
      const ui = await readAcJson<UiSkin>(path.join(carDir, 'skins', skin, 'ui_skin.json'));
      const name = typeof ui?.skinname === 'string' ? ui.skinname.trim() : '';
      return { id: skin, name: name || skin };
    })
  );
}

/** The car's own description, as ui_car.json writes it (HTML and all). */
export async function readCarDescription(id: string): Promise<string> {
  if (!isSafeSegment(id)) return '';

  const ui = await readAcJson<UiCar>(path.join(AC_CONTENT_CARS, id, 'ui', 'ui_car.json'));
  return typeof ui?.description === 'string' ? ui.description : '';
}

/**
 * Whether a string is safe to use as one path segment under the install.
 *
 * Car and skin ids arrive from query strings, and they are joined onto a filesystem
 * path — so anything that could climb out of content/cars is refused outright rather
 * than normalised. Folder names in an install are plain: letters, digits, and the
 * handful of separators below.
 */
export function isSafeSegment(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 _.\-+()#]*$/.test(value) && !value.includes('..');
}

/**
 * Where a car's assets sit in the install: the badge every car has, and one preview per
 * livery. Callers have already checked both ids with {@link isSafeSegment}.
 */
export function carBadgeFile(id: string): string {
  return path.join(AC_CONTENT_CARS, id, 'ui', 'badge.png');
}

export function carPreviewFile(id: string, skin: string): string {
  return path.join(AC_CONTENT_CARS, id, 'skins', skin, 'preview.jpg');
}

export function carUiJsonFile(id: string): string {
  return path.join(AC_CONTENT_CARS, id, 'ui', 'ui_car.json');
}
