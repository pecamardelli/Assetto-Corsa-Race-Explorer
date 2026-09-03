/**
 * How much traffic a round in the Test Drive mode puts on the road. Client-safe:
 * reading the track's lane plan and writing the mode's ini live in
 * lib/launch/traffic-plan and lib/launch/traffic-mode.
 *
 * The mode's own setting is a flat car count (`TRAFFIC_DENSITY`), which is the wrong
 * unit to carry between tracks: 100 cars is a traffic jam on New Forest's 3.6 km loop
 * and a quiet Sunday on a 20 km Alpine pass. Density per lane-kilometre travels; a car
 * count does not. So the count is normally derived, and pinning one is the exception.
 */

export interface TrafficConfig {
  /**
   * Cars per lane-kilometre, used whenever `cars` is null. Not per kilometre of
   * road: a two-way plan carries twice the traffic of a one-way plan over the same
   * tarmac, which is the point.
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
 * trying. New Forest's plan is 7.26 lane-km, so that band is 5.5–8.3 cars per lane-km
 * and its middle is 6.9. Rounded, 7 reproduces the recommendation on the track the
 * recommendation was made for (51 cars) and scales everywhere else.
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
 * A pinned count wins outright. Otherwise it is density times lane-kilometres, floored
 * at the mode's own minimum — a short road still needs enough cars to read as traffic
 * rather than as three strays.
 */
export function decideTrafficCars(
  config: TrafficConfig,
  road: TrafficRoad | null
): TrafficDecision {
  if (config.cars !== null) return { cars: config.cars, source: 'pinned' };

  // No plan on disk means no script traffic at all, so the number is academic; hand
  // back the floor rather than inventing a road.
  if (!road || road.laneKm <= 0) return { cars: TRAFFIC_CARS_MIN, source: 'derived' };

  const raw = Math.round(road.laneKm * config.perLaneKm);
  return { cars: clamp(raw, TRAFFIC_CARS_MIN, TRAFFIC_CARS_MAX), source: 'derived', road };
}
