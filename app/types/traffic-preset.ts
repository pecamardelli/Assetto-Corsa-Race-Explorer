/**
 * How much traffic a round in the Test Drive mode puts on the road. Client-safe:
 * reading the track's lane plan and writing the mode's ini live in
 * lib/launch/traffic-plan and lib/launch/traffic-mode.
 *
 * The mode's own setting is a flat car count (`TRAFFIC_DENSITY`), which is the wrong
 * unit to carry between tracks. Not for the reason first assumed, though. The simulation
 * never spreads its cars over the road: it spawns them 400–1000 m from the camera and
 * removes them past 1500 m, so every car it is given lives in the kilometre or so around
 * the player, however long the road is. A count sized to a road's total length is
 * therefore a wall of cars on a long one — 262 on the Evo Triangle, 2026-09-05, "literally
 * full of traffic cars in both ways". What travels between tracks is density per
 * lane-kilometre *within that reach*: a compact loop has all of itself in reach, a
 * mountain pass folded into hairpins has more road in reach than a straight coast road,
 * and the count follows. So the count is normally derived, and pinning one is the
 * exception.
 */

/**
 * How far from the camera the simulation keeps traffic alive, in metres: its
 * `despawnDistance` (`csp-traffic-tool/src/simulation/TrafficConfig.lua`; cars spawn in
 * the 400–1000 m ring inside it). The lane length within this radius is what a car count
 * is spread over.
 */
export const TRAFFIC_REACH_M = 1500;

export interface TrafficConfig {
  /**
   * Cars per lane-kilometre within the simulation's reach, used whenever `cars` is
   * null. Not per kilometre of road: a two-way plan carries twice the traffic of a
   * one-way plan over the same tarmac, which is the point.
   */
  perLaneKm: number;
  /** A pinned car count, or null to derive one from the road. */
  cars: number | null;
}

/**
 * 7 cars per lane-kilometre.
 *
 * Calibrated against the one measurement there is. `docs/AC Traffic in Races.md`
 * records that 100 cars on New Forest was "very busy — busy enough that it turned a
 * reasonable braking rule into a parking brake", and puts 40–60 as the band worth
 * trying. New Forest's plan is 7.26 lane-km, all of it within reach, so that band is
 * 5.5–8.3 cars per lane-km and its middle is 6.9. Rounded, 7 reproduces the
 * recommendation on the track the recommendation was made for (51 cars) and gives every
 * other road the same local density.
 */
export const DEFAULT_TRAFFIC: TrafficConfig = {
  perLaneKm: 7,
  cars: null,
};

/** What the mode itself accepts; anything outside this is refused by CSP, not clamped. */
export const TRAFFIC_CARS_MIN = 20;
export const TRAFFIC_CARS_MAX = 2500;

/** The useful end of the range, for the editor's sliders. */
export const TRAFFIC_PER_LANE_KM_MAX = 20;
export const TRAFFIC_CARS_SLIDER_MAX = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Coerce anything read from disk or a request body into a complete config. */
export function sanitizeTraffic(input: unknown): TrafficConfig {
  const raw = (input ?? {}) as Record<string, unknown>;

  const perLaneKm =
    typeof raw.perLaneKm === 'number' && Number.isFinite(raw.perLaneKm)
      ? clamp(raw.perLaneKm, 0.5, TRAFFIC_PER_LANE_KM_MAX)
      : DEFAULT_TRAFFIC.perLaneKm;

  const cars =
    typeof raw.cars === 'number' && Number.isFinite(raw.cars)
      ? Math.round(clamp(raw.cars, TRAFFIC_CARS_MIN, TRAFFIC_CARS_MAX))
      : null;

  return { perLaneKm, cars };
}

/** The road a plan describes, as far as the car count is concerned. */
export interface TrafficRoad {
  lanes: number;
  /** Every lane's length added together, in kilometres. */
  laneKm: number;
  /**
   * Lane-kilometres within `TRAFFIC_REACH_M` of a typical point on the road: what the
   * simulation's cars are actually spread over. Equal to `laneKm` on a compact loop, a
   * small fraction of it on a long road.
   */
  reachKm: number;
}

export interface TrafficDecision {
  cars: number;
  /** 'pinned' when the config named a number, 'derived' when the road set it. */
  source: 'pinned' | 'derived';
  /** The road it was derived from, absent when the count was pinned or unmeasurable. */
  road?: TrafficRoad;
}

/**
 * How many cars this road gets.
 *
 * A pinned count wins outright. Otherwise it is density times the lane-kilometres within
 * reach, floored at the mode's own minimum — a short road still needs enough cars to
 * read as traffic rather than as three strays.
 */
export function decideTrafficCars(
  config: TrafficConfig,
  road: TrafficRoad | null
): TrafficDecision {
  if (config.cars !== null) return { cars: config.cars, source: 'pinned' };

  // No plan on disk means no script traffic at all, so the number is academic; hand
  // back the floor rather than inventing a road.
  if (!road || road.reachKm <= 0) return { cars: TRAFFIC_CARS_MIN, source: 'derived' };

  const raw = Math.round(road.reachKm * config.perLaneKm);
  return { cars: clamp(raw, TRAFFIC_CARS_MIN, TRAFFIC_CARS_MAX), source: 'derived', road };
}
