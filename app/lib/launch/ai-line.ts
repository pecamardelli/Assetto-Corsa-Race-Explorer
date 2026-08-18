import { promises as fs } from 'fs';
import path from 'path';
import { AC_CONTENT_TRACKS } from './paths';

/**
 * Which AI line a track is raced on.
 *
 * A track can want two different lines from the same tarmac. On a closed circuit the
 * fast line is the fast line: apex to apex, using the full width, which is the whole
 * point of a racing line and exactly what `fast_lane.ai` normally holds. On a road
 * that still has the public on it, that same line is lethal — it crosses to the
 * outside on every corner entry, and on a two-way traffic plan the outside is the
 * oncoming carriageway. The road wants a line recorded *in a lane*, which gives up a
 * second a lap and stops the field meeting a Fiat head-on at every corner.
 *
 * Assetto Corsa reads one file, `ai/fast_lane.ai`, so both cannot be installed at
 * once. A track that keeps `fast_lane_racing.ai` and `fast_lane_road.ai` beside it
 * declares that it has both, and the launcher installs whichever the round is being
 * raced with. Tracks with neither are left completely alone.
 *
 * Measured on `new_forest_2_5`, where the two lanes are only 2.7 m apart: the racing
 * line strays 1.64 m from the lane centre at the 90th percentile, the recorded road
 * line 0.59 m. More than half a lane is the difference between passing a car and
 * meeting it.
 */

/** Variant filenames, beside `fast_lane.ai` in the same folder. */
const ROAD = 'fast_lane_road.ai';
const RACING = 'fast_lane_racing.ai';
const ACTIVE = 'fast_lane.ai';

/**
 * A spline payload cache. Assetto Corsa keys its own AI grid cache by content hash and
 * so re-reads a swapped line correctly, but a stale `fast_lane_payloads.bin` sitting
 * beside a line it no longer describes is a known way to break a track — it declares a
 * point count that the spline does not have.
 */
const PAYLOADS = 'fast_lane_payloads.bin';

export interface AiLineOutcome {
  /** Which variant is now installed. */
  variant: 'road' | 'racing';
  /** False when the right one was already in place and nothing was written. */
  swapped: boolean;
}

/** The folder holding a track layout's AI splines, or null when it has none. */
async function aiFolder(track: string, trackConfig: string): Promise<string | null> {
  const candidates = trackConfig
    ? [path.join(AC_CONTENT_TRACKS, track, trackConfig, 'ai'), path.join(AC_CONTENT_TRACKS, track, 'ai')]
    : [path.join(AC_CONTENT_TRACKS, track, 'ai')];

  for (const folder of candidates) {
    if (await fs.stat(folder).then(s => s.isDirectory(), () => false)) return folder;
  }

  return null;
}

async function readIfPresent(file: string): Promise<Buffer | null> {
  return fs.readFile(file).catch(() => null);
}

/**
 * Put the line this round should be raced on into `fast_lane.ai`.
 *
 * Returns undefined when the track does not carry the variant asked for, which is the
 * ordinary case: almost every track has one line and no opinion about it. Nothing is
 * written when the right line is already installed, so repeated launches of the same
 * round do not churn the file or invalidate Assetto Corsa's spline cache.
 */
export async function installAiLine(
  track: string,
  trackConfig: string,
  roadTraffic: boolean
): Promise<AiLineOutcome | undefined> {
  const folder = await aiFolder(track, trackConfig);
  if (!folder) return undefined;

  const variant = roadTraffic ? 'road' : 'racing';
  const wanted = await readIfPresent(path.join(folder, roadTraffic ? ROAD : RACING));
  if (!wanted) return undefined;

  const active = await readIfPresent(path.join(folder, ACTIVE));
  if (active && active.equals(wanted)) return { variant, swapped: false };

  await fs.writeFile(path.join(folder, ACTIVE), wanted);
  await fs.rm(path.join(folder, PAYLOADS), { force: true });

  return { variant, swapped: true };
}
