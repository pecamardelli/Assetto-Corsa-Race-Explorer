import { calculateStandings } from '../standings';
import { partitionRoster } from '../traffic';
import { Championship, ChampionshipOpponent, DriverStanding, Season } from '../../types/race';

/**
 * The order a round's field goes out in.
 *
 * It is the championship table, best-placed first: it seeds the batches of a round
 * too big for its track, so the sharp end runs together and a driver meets the
 * people they are actually fighting, and on a point-to-point round — where there is
 * no qualifying to line anybody up — it is the starting grid itself.
 *
 * Before a season has a result to seed on there is nothing to sort by, so the
 * opening round is drawn at random from its own name: the same round always draws
 * the same way, and the order you were shown is the order you race.
 */

/** mulberry32, seeded off a string: same seed, same shuffle, run after run. */
function randomFrom(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193) >>> 0;
  }

  return () => {
    hash = (hash + 0x6d2b79f5) >>> 0;
    let value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, drawing from `next`. */
function shuffled<T>(items: T[], next: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Has this season produced anything to seed on?
 *
 * Qualifying alone does not count. Standings exist the moment any session is on file,
 * but until a race has been classified every driver sits on nothing and the order is
 * whatever the tie-break fell back to — which is alphabetical, not a championship.
 */
export function seasonHasForm(standings: DriverStanding[]): boolean {
  return standings.some(entry => entry.racesCompleted > 0);
}

/**
 * The field in running order: championship leader first, then down the table.
 *
 * A driver the standings have never seen — a mid-season entry, or anyone who has yet
 * to take a start — keeps their roster order and goes to the back, behind everyone
 * who has actually scored.
 */
export function orderByStandings(
  opponents: ChampionshipOpponent[],
  standings: DriverStanding[]
): ChampionshipOpponent[] {
  const position = new Map(standings.map((entry, index) => [entry.name, index]));

  return [...opponents].sort((a, b) => {
    const rankA = position.get(a.name) ?? Infinity;
    const rankB = position.get(b.name) ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    return opponents.indexOf(a) - opponents.indexOf(b);
  });
}

/** The field drawn at random, the same way every time for a given `seed`. */
export function orderAtRandom(
  opponents: ChampionshipOpponent[],
  seed: string
): ChampionshipOpponent[] {
  return shuffled(opponents, randomFrom(seed));
}

export interface FieldOrder {
  /** The season's racing drivers, best-placed first. Traffic is not among them. */
  order: ChampionshipOpponent[];
  /**
   * The road's traffic, in roster order. It has no place in a running order seeded
   * on a championship table it does not appear in, but it still has to go out: it
   * joins every batch of a split round, and starts a point-to-point round at the
   * back, ahead of the field on the road and behind it in the results.
   */
  traffic: ChampionshipOpponent[];
  /** What it was seeded on: the season's table, or an opening-round draw. */
  seededOn: 'standings' | 'random';
  /** The table it was seeded on, empty-ish before the season's first race. */
  standings: DriverStanding[];
}

/**
 * Work out that order for one round of one season.
 *
 * Shared by the route that shows the batches and the launcher that races them, so
 * the grid a menu offers is the grid that goes out — including the seed the opening
 * round's draw is made from.
 */
export function fieldOrder(
  championship: Championship,
  season: Season,
  roundNumber: number
): FieldOrder {
  // Standings are a season's business, so ask this season rather than the whole
  // championship — the same season-scoped view the standings page builds.
  const seasonChampionship: Championship = {
    id: championship.id,
    data: season.data,
    folderName: championship.folderName,
    sessions: season.sessions,
    seasons: [season],
  };

  const standings = calculateStandings(seasonChampionship);
  const { racing, traffic } = partitionRoster(season.data.opponents);
  const seededOn = seasonHasForm(standings) ? 'standings' : 'random';

  const order =
    seededOn === 'standings'
      ? orderByStandings(racing, standings)
      : orderAtRandom(racing, `${championship.id}|${season.seasonName}|${roundNumber}`);

  return { order, traffic, seededOn, standings };
}
