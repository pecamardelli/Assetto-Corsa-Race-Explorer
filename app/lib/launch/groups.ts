import { ChampionshipOpponent, DriverStanding } from '../../types/race';
import { getTrackData } from '../track-data';
import { LaunchGroup, resolveTrack } from './plan';

/**
 * Splitting a round that will not fit its track.
 *
 * A pass with sixteen pit boxes cannot take a thirty-two car championship, and the
 * answer is not to leave half the field at home: it goes out in batches, each racing
 * on its own, all of them classified together on the clock afterwards. That is what
 * this builds — the batches. Putting them back together is `mergeGroupedRounds`.
 *
 * The batches are seeded on the championship, best-placed first, so the sharp end of
 * the table runs together and a driver meets the people they are actually fighting.
 * Before a season has a result to seed on there is nothing to sort by, so the first
 * round is drawn at random — from the round's own name, so the same round always
 * draws the same way and the batch you were shown is the batch you race.
 */

/** Batch names, in the order they go out. */
const LABELS = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'];

/** Pit boxes the round's track has, or null when its data is not on file. */
export function pitCapacity(roundTrack: string, track: string, trackConfig: string): number | null {
  const data = getTrackData(track, trackConfig) ?? getTrackData(roundTrack);
  const boxes = Number(data?.pitboxes);

  return Number.isFinite(boxes) && boxes > 0 ? boxes : null;
}

/** The same, going through AC's content to split the layout off the folder name. */
export async function pitCapacityFor(roundTrack: string): Promise<number | null> {
  const { track, trackConfig } = await resolveTrack(roundTrack);
  return pitCapacity(roundTrack, track, trackConfig);
}

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

/**
 * How a round should be divided to fit `capacity` cars at a time.
 *
 * `order` is the field already in running order — see `orderByStandings` and
 * `orderAtRandom`. Batches are evened out rather than filled to the brim: twenty-one
 * cars into sixteen boxes goes as eleven and ten, not sixteen and five, because a
 * five-car race is not worth loading the game for.
 *
 * Returns an empty list when the field already fits, which is the ordinary case and
 * the caller's signal to race the round whole.
 */
export function planGroups(order: ChampionshipOpponent[], capacity: number): LaunchGroup[] {
  if (capacity < 2) return [];
  if (order.length <= capacity) return [];

  const count = Math.ceil(order.length / capacity);
  const per = Math.ceil(order.length / count);

  return Array.from({ length: count }, (_, index) => ({
    label: LABELS[index] ?? `Group ${index + 1}`,
    drivers: order.slice(index * per, (index + 1) * per).map(entry => entry.name),
  }));
}
