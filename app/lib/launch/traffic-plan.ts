import { promises as fs } from 'fs';
import path from 'path';
import { AC_CONTENT_TRACKS } from './paths';
import { TrafficRoad } from '../../types/traffic-preset';

/**
 * Reading a track's CSP traffic plan, to size the traffic to the road.
 *
 * `data/traffic.json` beside `surfaces.ini` is the whole of what the Test Drive mode
 * reads about a road: a list of lanes, each a polyline of world-space points. Its total
 * length is the only honest denominator for a car count, so this measures it rather than
 * trusting `ui_track.json` — the plan need not cover the whole track, and on a two-way
 * road it covers it twice.
 *
 * A track with no plan gets no script traffic whatever this returns, so null is a fact
 * about the road and not an error.
 */

interface PlanLane {
  points?: unknown;
  loop?: unknown;
}

/** Layout folder first, then the track root: the same order `ai-line` resolves in. */
function candidates(track: string, trackConfig: string): string[] {
  const file = ['data', 'traffic.json'];
  return trackConfig
    ? [
        path.join(AC_CONTENT_TRACKS, track, trackConfig, ...file),
        path.join(AC_CONTENT_TRACKS, track, ...file),
      ]
    : [path.join(AC_CONTENT_TRACKS, track, ...file)];
}

function isPoint(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every(component => typeof component === 'number' && Number.isFinite(component))
  );
}

/** Polyline length in metres, closing the loop when the lane declares itself one. */
function laneLength(points: Array<[number, number, number]>, loop: boolean): number {
  if (points.length < 2) return 0;

  const last = loop ? points.length : points.length - 1;
  let total = 0;
  for (let i = 0; i < last; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  return total;
}

/**
 * The lane count and total lane length of a track's traffic plan, or null when it has
 * none, cannot be read, or holds nothing drivable.
 */
export async function readTrafficRoad(
  track: string,
  trackConfig: string
): Promise<TrafficRoad | null> {
  for (const file of candidates(track, trackConfig)) {
    let raw: string;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') console.error(`Could not read traffic plan ${file}:`, error);
      continue;
    }

    let parsed: { lanes?: unknown };
    try {
      // These are hand-drawn or generated files that have been round-tripped through
      // several tools; a BOM is more likely here than in anything the app writes.
      parsed = JSON.parse(raw.replace(/^﻿/, '')) as { lanes?: unknown };
    } catch (error) {
      console.error(`Traffic plan ${file} is not valid JSON:`, error);
      return null;
    }

    if (!Array.isArray(parsed.lanes)) return null;

    let lanes = 0;
    let metres = 0;
    for (const lane of parsed.lanes as PlanLane[]) {
      if (!Array.isArray(lane?.points)) continue;
      const points = lane.points.filter(isPoint);
      const length = laneLength(points, lane.loop === true);
      if (length <= 0) continue;
      lanes += 1;
      metres += length;
    }

    return lanes > 0 ? { lanes, laneKm: metres / 1000 } : null;
  }

  return null;
}
