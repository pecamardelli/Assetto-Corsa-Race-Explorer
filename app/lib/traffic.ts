import { ChampionshipOpponent, ChampionshipRound, DriverStatistics } from '../types/race';

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
   * Where they finished among the drivers who were racing: the position the
   * championship pays out on. 999 for anyone the session never classified, which is
   * what the standings have always read an absent position as.
   */
  position: number;
}

/**
 * A session's classification with the traffic taken out and the drivers behind it
 * moved up by however many traffic cars they were stuck behind.
 *
 * Note what this deliberately does not do: renumber the field from one. A finishing
 * order is allowed to have holes in it — a driver who retires is left without a
 * position at all, and the classification runs ...18, 19, 21... around them. Packing
 * the survivors down into a dense 1..N would quietly close those holes too and hand
 * everybody behind a retirement a place they did not finish in, rewriting the points
 * of every race already on file.
 *
 * So each driver is moved up by exactly the number of traffic cars classified ahead
 * of them, and nothing else moves. On a session with no traffic in it that is a
 * subtraction of zero, and the recorded positions come back untouched.
 */
export function classifyScoring(
  drivers: Record<string, DriverStatistics>,
  traffic: ReadonlySet<string>
): ScoringEntry[] {
  const ahead = Object.entries(drivers)
    .filter(([name, stats]) => traffic.has(name) && typeof stats.position === 'number')
    .map(([, stats]) => stats.position as number);

  return Object.entries(drivers)
    .filter(([name]) => !traffic.has(name))
    .map(([name, stats]) => {
      const recorded = typeof stats.position === 'number' ? stats.position : null;

      return {
        name,
        stats,
        position:
          recorded === null
            ? 999
            : recorded - ahead.filter(position => position < recorded).length,
      };
    });
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
  let best = Infinity;
  let driver = '';

  for (const [name, stats] of Object.entries(drivers)) {
    if (traffic.has(name)) continue;
    const lap = typeof stats.best_lap === 'number' ? stats.best_lap : 0;
    if (lap > 0 && lap < best) {
      best = lap;
      driver = name;
    }
  }

  return driver;
}

/**
 * The Assetto Corsa mode a round is raced in, or undefined for an ordinary race.
 *
 * Custom Shaders Patch traffic will not run in a stock race session — its own Traffic
 * mode is declared `BASE_MODE=PRACTICE`, which can host a road full of cars but never
 * a classified result. `test-drive` is our mode: `BASE_MODE=RACE`, so it scores, and
 * it adds the things a race in traffic needs that free-roam never did — competitors
 * that see the traffic, wrecks that clear themselves, cars righted where they land,
 * and a road held still until the flag drops. It lives outside this repo, in Assetto
 * Corsa's own `extension/lua/new-modes/test-drive`, mirrored at
 * `Modding/Tools/test-drive-mode`.
 */
export function customModeFor(round: ChampionshipRound): string | undefined {
  return round.cspTraffic ? 'test-drive' : undefined;
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
  return round.cspTraffic ? opponents.filter(entry => !isTraffic(entry)) : opponents;
}
