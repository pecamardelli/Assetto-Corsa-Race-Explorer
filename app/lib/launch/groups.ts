import { ChampionshipOpponent } from '../../types/race';
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
 * The order the batches are seeded from is `fieldOrder`, which is the championship
 * table itself.
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

/**
 * How a round should be divided to fit `capacity` cars at a time.
 *
 * `order` is the field already in running order — see `fieldOrder`. Batches are
 * evened out rather than filled to the brim: twenty-one cars into sixteen boxes
 * goes as eleven and ten, not sixteen and five, because a five-car race is not
 * worth loading the game for.
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
