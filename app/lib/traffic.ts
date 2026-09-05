import { ChampionshipOpponent, ChampionshipRound, DriverStatistics } from '../types/race';
import { ClassLookup, SINGLE_CLASS } from './racing-classes';

/**
 * Traffic: the cars that share the road without contesting the championship.
 *
 * A road series driven on public passes and coast roads is not a race meeting with
 * an empty circuit. The point of it — the thing Test Drive was built on — is that
 * there is a lorry round the blind left-hander and a Fiat doing fifty on the climb,
 * and the driver who gets past them cleanly beats the one who does not. So the
 * traffic has to actually be in the session: Assetto Corsa has no notion of a car
 * that is present but not entered, and every car on the road is an entry in the
 * .champ like anyone else.
 *
 * What it must not be is a competitor. A Fiat 128 collecting championship points for
 * finishing eleventh would make nonsense of the table, and worse, it would quietly
 * rob the drivers behind it: Assetto Corsa classifies on the road, so a lorry
 * finishing sixth pushes the sixth-placed driver to seventh and costs them points
 * they earned. Marking an entry `traffic: true` deals with both. The standings never
 * see it, and the field closes ranks over it — positions are re-ranked among the
 * drivers who are actually racing, so a round won behind two lorries scores as the
 * win it was.
 *
 * Everything downstream reads the concept from here: standings, the running order a
 * grid is built from, and the way a round too big for its track is split up.
 */

/** Does this entry drive the road rather than race it? */
export function isTraffic(opponent: ChampionshipOpponent): boolean {
  return opponent.traffic === true;
}

/**
 * The names driving as traffic across any number of rosters.
 *
 * Rosters rather than one roster because the callers work at different scopes: a
 * season's table asks its own entry list, the all-time table asks every season of
 * every championship at once. A name marked traffic anywhere is traffic everywhere,
 * which is the behaviour you want — the Fiats are the same Fiats each season.
 */
export function trafficNames(rosters: Iterable<ChampionshipOpponent[]>): Set<string> {
  const names = new Set<string>();
  for (const roster of rosters) {
    for (const opponent of roster) {
      if (isTraffic(opponent)) names.add(opponent.name);
    }
  }
  return names;
}

/** Split a roster into the drivers contesting the championship and the traffic. */
export function partitionRoster(opponents: ChampionshipOpponent[]): {
  racing: ChampionshipOpponent[];
  traffic: ChampionshipOpponent[];
} {
  return {
    racing: opponents.filter(entry => !isTraffic(entry)),
    traffic: opponents.filter(isTraffic),
  };
}

export interface ScoringEntry {
  name: string;
  stats: DriverStatistics;
  /**
   * Where they finished among the drivers who were racing *them*: the position the
   * championship pays out on. 999 for anyone the session never classified, which is
   * what the standings have always read an absent position as.
   */
  position: number;
  /** The class that position is within, empty in a single-class session. */
  class: string;
}

/**
 * A session's classification as each driver's own class scores it: the traffic taken
 * out, the other classes taken out, and everyone moved up by however many cars they
 * were stuck behind that they were not racing.
 *
 * Both exclusions are the same idea — a car ahead of you that you are not being
 * measured against should not cost you a place — so they are one subtraction. A
 * lorry and an LMP1 are equally irrelevant to the GT driver's result.
 *
 * Note what this deliberately does not do: renumber the field from one. A finishing
 * order is allowed to have holes in it — a driver who retires is left without a
 * position at all, and the classification runs ...18, 19, 21... around them. Packing
 * the survivors down into a dense 1..N would quietly close those holes too and hand
 * everybody behind a retirement a place they did not finish in, rewriting the points
 * of every race already on file.
 *
 * So each driver is moved up by exactly the number of cars classified ahead of them
 * that are not scoring against them, and nothing else moves. On a single-class
 * session with no traffic in it that is a subtraction of zero, and the recorded
 * positions come back untouched — which is why every championship on file before
 * classes existed reads back identically.
 *
 * @param classes which class each driver races in; omit for a single-class session,
 *   where everyone is scored against everyone.
 */
export function classifyScoring(
  drivers: Record<string, DriverStatistics>,
  traffic: ReadonlySet<string>,
  classes: ClassLookup = SINGLE_CLASS
): ScoringEntry[] {
  const racing = Object.entries(drivers).filter(([name]) => !traffic.has(name));
  const running = new Set(racing.map(([name]) => classes(name)));

  // One class on the road — every championship that declares none, and every season
  // on file before classes existed. Move each driver up by the traffic classified
  // ahead of them and change nothing else, holes included.
  if (running.size <= 1) {
    const ahead = Object.entries(drivers)
      .filter(([name, stats]) => traffic.has(name) && typeof stats.position === 'number')
      .map(([, stats]) => stats.position as number);

    return racing.map(([name, stats]) => {
      const recorded = typeof stats.position === 'number' ? stats.position : null;

      return {
        name,
        stats,
        class: classes(name),
        position:
          recorded === null
            ? 999
            : recorded - ahead.filter(position => position < recorded).length,
      };
    });
  }

  // Several classes: each one is ranked among its own runners, in the order they
  // came home. This is a rank rather than a subtraction because the gaps in an
  // Assetto Corsa classification cannot be attributed to a class — a session whose
  // order runs ...16, 18... names nobody in the hole at 17, so there is no way to
  // tell whose race it was missing from. Subtracting only the cars we *can* see
  // would leave that hole in every class it was not in, and a class leader would
  // come out second with no win to show for the race they led.
  const rank = new Map<string, number>();
  for (const runningClass of running) {
    racing
      .filter(([name, stats]) => classes(name) === runningClass && typeof stats.position === 'number')
      .sort(([, a], [, b]) => (a.position as number) - (b.position as number))
      .forEach(([name], index) => rank.set(name, index + 1));
  }

  return racing.map(([name, stats]) => ({
    name,
    stats,
    class: classes(name),
    // Anyone the session never classified keeps the 999 the standings have always
    // read an absent position as, and scores nothing.
    position: rank.get(name) ?? 999,
  }));
}

/**
 * The fastest lap of a session, traffic ignored.
 *
 * Traffic runs to its own orders and will never be near the pace, but it is set to
 * lap the road all the same, and a lap of a shorter traffic layout could in theory
 * undercut the field. Leaving it out of the search costs nothing and removes the
 * question.
 */
export function fastestLapDriver(
  drivers: Record<string, DriverStatistics>,
  traffic: ReadonlySet<string>
): string {
  return fastestLapDrivers(drivers, traffic).get(SINGLE_CLASS('')) ?? '';
}

/**
 * The fastest lap of each class, traffic ignored: class → driver.
 *
 * One search per class rather than one for the session, because a class is a race of
 * its own and the lap that led it is the lap that led it. Asking the whole field at
 * once would give every fastest lap of the 2015 season to an LMP1 car — a GT car is
 * twenty seconds a lap slower and could never win one, so the GT drivers would be
 * racing for a statistic they had no way of scoring.
 *
 * Classes with nobody who set a timed lap are simply absent from the map.
 */
export function fastestLapDrivers(
  drivers: Record<string, DriverStatistics>,
  traffic: ReadonlySet<string>,
  classes: ClassLookup = SINGLE_CLASS
): Map<string, string> {
  const best = new Map<string, { driver: string; lap: number }>();

  for (const [name, stats] of Object.entries(drivers)) {
    if (traffic.has(name)) continue;
    const lap = typeof stats.best_lap === 'number' ? stats.best_lap : 0;
    if (lap <= 0) continue;

    const racing = classes(name);
    const standing = best.get(racing);
    if (!standing || lap < standing.lap) best.set(racing, { driver: name, lap });
  }

  return new Map([...best].map(([racing, { driver }]) => [racing, driver]));
}

/**
 * The Assetto Corsa mode a round flagged `cspTraffic` is raced in, or null to race such
 * rounds as ordinary races with their roster traffic.
 *
 * Custom Shaders Patch traffic will not run in a stock race session — its own Traffic
 * mode is declared `BASE_MODE=PRACTICE`, which can host a road full of cars but never
 * a classified result. Both of ours are `BASE_MODE=RACE`, so they score. They live
 * outside this repo, in Assetto Corsa's own `extension/lua/new-modes/<name>`, mirrored
 * under `Modding/Tools/`:
 *
 * - `test-drive` (current; given another chance 2026-09-05 afternoon): the track's own
 *   AI spline, AI that dodges traffic when it can and brakes when it cannot, crashed
 *   cars respawned where they land and never retired or pitted, the mode's own lap
 *   count, the game closed when everyone is home. Direttore's marshal stands down for
 *   it. Its repositioning kills AC's lap counter, which is why the launcher flags
 *   `traffic` in the launch context for it and racestats then ranks by the laps it
 *   counted itself.
 * - `traffic-race`: the minimal fallback. The same traffic and the same dodging, and
 *   nothing else — AC's own lap counter and leaderboard, the marshal on duty as in any
 *   race, no respawns.
 */
export type TrafficMode = 'traffic-race' | 'test-drive';

export const TRAFFIC_MODE: TrafficMode | null = 'test-drive';

/** Whether this round actually goes to a traffic mode: flagged for it, and a mode selected. */
export function usesTrafficMode(round: ChampionshipRound): boolean {
  return TRAFFIC_MODE !== null && Boolean(round.cspTraffic);
}

export function customModeFor(round: ChampionshipRound): TrafficMode | undefined {
  return usesTrafficMode(round) && TRAFFIC_MODE !== null ? TRAFFIC_MODE : undefined;
}

/**
 * The entries that actually take the grid for a round.
 *
 * Identical to the roster except on a round whose road supplies its own traffic, where
 * the roster's traffic would be a second, worse set of it — and would eat pit boxes
 * that the real field needs.
 */
export function fieldFor(
  opponents: ChampionshipOpponent[],
  round: ChampionshipRound
): ChampionshipOpponent[] {
  return usesTrafficMode(round) ? opponents.filter(entry => !isTraffic(entry)) : opponents;
}
