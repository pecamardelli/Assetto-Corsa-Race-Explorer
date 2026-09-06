/**
 * Which traffic models a road gets: the fleet.
 *
 * CSP's traffic tool loads every model in its data folder and spawns them all, weighted
 * only by each model's own `chance`. One folder now holds a Giulietta for Amalfi, a
 * Holden for New Plymouth and a Lada for the Transfăgărășan, so without a cast list
 * every road would carry all of them. The cast list lives in `app/data/traffic-fleets.json`:
 * named fleets (a set of model ids with spawn weights) and a map from track id to fleet.
 * The launcher writes the resolved list into the Test Drive mode's settings as
 * `TRAFFIC_CARS=id:weight,id:weight,...`, and the mode trims CSP's model list to it
 * before the simulation builds its pools. A track with no fleet leaves the key empty,
 * which the mode reads as "every model" — what it always did.
 *
 * Model ids are the JSON file names in `extension/lua/tools/csp-traffic-tool/data`,
 * which is also what `Modding/Tools/ac_car_tools/traffic_fleet_build.py` installs
 * them as. Nothing here checks the install; `scripts/check-traffic-fleets.js` does.
 */
import { promises as fs } from 'fs';
import path from 'path';

export interface FleetEntry {
  /** Traffic model id: the JSON's file name without the extension. */
  id: string;
  /** Spawn weight; CSP draws models in proportion to it. */
  weight: number;
}

export interface TrafficFleets {
  /** Named fleets: a road's cast. */
  fleets: Record<string, FleetEntry[]>;
  /** Track id (with layout, as rounds key it) → fleet name. */
  tracks: Record<string, string>;
}

export interface TrafficFleetDecision {
  /** The fleet name the track resolved to. */
  fleet: string;
  entries: FleetEntry[];
  /** The exact string written to the mode's `TRAFFIC_CARS`. */
  spec: string;
}

export const FLEETS_FILE = path.join(process.cwd(), 'app', 'data', 'traffic-fleets.json');

function isEntry(value: unknown): value is FleetEntry {
  const raw = value as Record<string, unknown>;
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof raw.id === 'string' &&
    raw.id.length > 0 &&
    typeof raw.weight === 'number' &&
    Number.isFinite(raw.weight) &&
    raw.weight > 0
  );
}

/** Read the fleet table, tolerating a missing file (no fleets, every road gets all). */
export async function readTrafficFleets(file: string = FLEETS_FILE): Promise<TrafficFleets> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { fleets: {}, tracks: {} };
    throw error;
  }
  const raw = (parsed ?? {}) as Record<string, unknown>;
  const fleets: Record<string, FleetEntry[]> = {};
  for (const [name, list] of Object.entries((raw.fleets ?? {}) as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    fleets[name] = list.filter(isEntry).map(entry => ({ id: entry.id, weight: entry.weight }));
  }
  const tracks: Record<string, string> = {};
  for (const [track, fleet] of Object.entries((raw.tracks ?? {}) as Record<string, unknown>)) {
    if (typeof fleet === 'string' && fleet in fleets) tracks[track] = fleet;
  }
  return { fleets, tracks };
}

/**
 * The `TRAFFIC_CARS` value for a fleet. Weights are written with two decimals, which
 * is all the precision a spawn ratio needs and keeps the line readable in the ini.
 */
export function fleetSpec(entries: FleetEntry[]): string {
  return entries.map(entry => `${entry.id}:${entry.weight.toFixed(2)}`).join(',');
}

/**
 * The fleet for a round's track, or null when the table names none for it.
 *
 * Looked up by the full track id first (`amalfidrive-costaditalia_circuit`), then by
 * the base track (`amalfidrive`), so a table can cast a whole track in one line and
 * still single out a layout.
 */
export function resolveTrafficFleet(
  table: TrafficFleets,
  roundTrack: string
): TrafficFleetDecision | null {
  const candidates = [roundTrack];
  const dash = roundTrack.lastIndexOf('-');
  if (dash > 0) candidates.push(roundTrack.slice(0, dash));
  for (const key of candidates) {
    const fleet = table.tracks[key];
    if (!fleet) continue;
    const entries = table.fleets[fleet] ?? [];
    if (entries.length === 0) continue;
    return { fleet, entries, spec: fleetSpec(entries) };
  }
  return null;
}
