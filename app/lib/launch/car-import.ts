import { promises as fs } from 'fs';
import path from 'path';
import { carBadgeFile, carUiJsonFile, isSafeSegment } from './car-catalog';
import { forgetCarData } from '../car-data';

/**
 * Pulling one car's data out of the install and into the repo.
 *
 * `scripts/copy-car-data.js` has always done this in bulk, at build time: it walks every
 * .champ and every result, and copies `ui_car.json` and the badge for any car it finds
 * that the repo does not have. That works because until now a car only ever entered the
 * repo by being written into a .champ by hand, and the build came afterwards.
 *
 * Picking a car in the app turns that around — the car is chosen at runtime, and every
 * page that renders it (the season card, the lineup, the standings, the car's own page)
 * reads `app/data/cars` and `public/badges`, not the install. So a pick brings its car's
 * data across with it, on the same terms the script uses: copy what is missing, never
 * overwrite what is there, and drop the curves and tags that make the file large.
 *
 * The badge is copied verbatim. The bulk script shrinks anything over 1024 px wide with
 * sharp, which is worth doing on 350 badges at build time and is not worth making a
 * save depend on for one; the next run of the script leaves an already-copied badge
 * alone, so a large one stays large. It is a picture in a 72 px box either way.
 */

const CARS_DIR = path.join(process.cwd(), 'app', 'data', 'cars');
const BADGES_DIR = path.join(process.cwd(), 'public', 'badges');

/** What the bulk script strips: curve tables and tags, which nothing here renders. */
const DROPPED_KEYS = ['power_curve', 'torque_curve', 'powerCurve', 'torqueCurve', 'tags'];

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyCarData(id: string): Promise<boolean> {
  const target = path.join(CARS_DIR, `${id}.json`);
  if (await exists(target)) return false;

  let raw: string;
  try {
    raw = await fs.readFile(carUiJsonFile(id), 'utf8');
  } catch {
    return false;
  }

  // The same repair the bulk script makes: a BOM, and the raw tabs and newlines every
  // multi-paragraph description carries inside its string.
  const repaired = raw
    .replace(/^﻿/, '')
    .replace(/("(?:[^"\\]|\\.)*")/g, match =>
      match.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    );

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(repaired) as Record<string, unknown>;
  } catch (error) {
    console.error(`Could not read the installed data for ${id}:`, error);
    return false;
  }

  for (const key of DROPPED_KEYS) delete data[key];

  await fs.mkdir(CARS_DIR, { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');

  // getCarData caches a miss as hard as a hit, and this car was almost certainly asked
  // for a moment ago to render the picker.
  forgetCarData(id);
  return true;
}

async function copyBadge(id: string): Promise<boolean> {
  const target = path.join(BADGES_DIR, `${id}.png`);
  if (await exists(target)) return false;

  try {
    await fs.mkdir(BADGES_DIR, { recursive: true });
    await fs.copyFile(carBadgeFile(id), target);
    return true;
  } catch {
    // Plenty of mods ship no badge. The pages that show one fall back on their own.
    return false;
  }
}

export interface CarImport {
  /** Whether this call is what put the car's data in the repo. */
  data: boolean;
  badge: boolean;
}

/**
 * Make sure the repo has what it needs to render this car. Safe to call for a car it
 * already has, which is the usual case — nothing is overwritten and nothing is copied.
 */
export async function importCarAssets(id: string): Promise<CarImport> {
  if (!isSafeSegment(id)) return { data: false, badge: false };

  const [data, badge] = await Promise.all([copyCarData(id), copyBadge(id)]);
  return { data, badge };
}
