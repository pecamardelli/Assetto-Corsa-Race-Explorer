import { promises as fs } from 'fs';
import path from 'path';
import { AC_CONTENT_TRACKS } from './paths';
import { TRAFFIC_REACH_M, TrafficRoad } from '../../types/traffic-preset';

/**
 * Reading a track's CSP traffic plan, to size the traffic to the road.
 *
 * `data/traffic.json` beside `surfaces.ini` is the whole of what the Test Drive mode
 * reads about a road: a list of lanes, each a polyline of world-space points.
 *
 * Two lengths come out of it. The total lane length is what the plan covers, measured
 * rather than read off `ui_track.json` — the plan need not cover the whole track, and on
 * a two-way road it covers it twice. It is the wrong denominator for a car count,
 * though, and that mistake put 262 cars into the kilometre around the player on the
 * Evo Triangle (2026-09-05). The simulation does not spread its cars over the road: it
 * spawns them 400–1000 m from the camera and removes them past 1500 m, so however long
 * the road is, every car it was given lives within that reach. The honest denominator is
 * therefore the lane length *within reach of a point on the road*, averaged along it:
 * `reachKm`. On a compact loop like New Forest the whole plan is within reach and the
 * two figures agree; on a 33 km loop they differ by a factor of nine.
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

type Point = [number, number, number];

/** One straight piece of a lane: where its middle is, and how long it is, in metres. */
interface Segment {
  x: number;
  z: number;
  length: number;
}

/** A lane's segments, closing the loop when the lane declares itself one. */
function laneSegments(points: Point[], loop: boolean): Segment[] {
  if (points.length < 2) return [];

  const last = loop ? points.length : points.length - 1;
  const segments: Segment[] = [];
  for (let i = 0; i < last; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    segments.push({
      x: (a[0] + b[0]) / 2,
      z: (a[2] + b[2]) / 2,
      length: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    });
  }
  return segments;
}

/** Roughly how many places along the road to stand and look around. */
const REACH_SAMPLES = 80;

/**
 * Lane metres within `reach` of a typical point on the road.
 *
 * Stands at evenly spaced points along every lane, adds up the lane length within the
 * radius of each (in plan view: a road folding back on itself 100 m below is still in
 * reach), and averages. A lorry does not care which lane the player is in, so the
 * samples come from all lanes in proportion to their length.
 */
function reachableLength(segments: Segment[], reach: number): number {
  if (segments.length === 0) return 0;

  const stride = Math.max(1, Math.floor(segments.length / REACH_SAMPLES));
  const reachSquared = reach * reach;
  let total = 0;
  let samples = 0;
  for (let i = 0; i < segments.length; i += stride) {
    const here = segments[i];
    let within = 0;
    for (const segment of segments) {
      const dx = segment.x - here.x;
      const dz = segment.z - here.z;
      if (dx * dx + dz * dz <= reachSquared) within += segment.length;
    }
    total += within;
    samples += 1;
  }
  return total / samples;
}

/**
 * The lane count, total lane length and within-reach lane length of a track's traffic
 * plan, or null when it has none, cannot be read, or holds nothing drivable.
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
    const segments: Segment[] = [];
    for (const lane of parsed.lanes as PlanLane[]) {
      if (!Array.isArray(lane?.points)) continue;
      const points = lane.points.filter(isPoint);
      const pieces = laneSegments(points, lane.loop === true);
      const length = pieces.reduce((sum, piece) => sum + piece.length, 0);
      if (length <= 0) continue;
      lanes += 1;
      metres += length;
      segments.push(...pieces);
    }

    if (lanes === 0) return null;
    return {
      lanes,
      laneKm: metres / 1000,
      reachKm: reachableLength(segments, TRAFFIC_REACH_M) / 1000,
    };
  }

  return null;
}
