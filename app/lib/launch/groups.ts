import { ChampionshipOpponent } from '../../types/race';
import { CAR_CLASSES, CarClass, classOfCar, displacementOf } from '../car-classes';
import { getTrackData } from '../track-data';
import { LaunchGroup, resolveTrack } from './plan';

/**
 * Splitting a round that will not fit its track.
 *
 * A pass with sixteen pit boxes cannot take a thirty-two car championship, and the
 * period answer was not to leave half the field at home: the entry was divided by
 * engine size and each class ran its own batch, all of them classified together on
 * the clock afterwards. That is what this builds — the batches. Putting them back
 * together is `mergeGroupedRounds`.
 *
 * Classes come out in ascending order, smallest engines first, the way an entry list
 * was printed. Neighbouring classes share a batch when they fit in one, because a
 * two-car race is not worth loading the game for; a class too big for the track on
 * its own is split by engine size, so even then the batches mean something.
 */

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

interface Bucket {
  carClass: CarClass;
  entries: ChampionshipOpponent[];
}

/** Smallest engine a class admits: whatever the class below it stopped at. */
function lowerLimit(carClass: CarClass): number {
  const index = CAR_CLASSES.indexOf(carClass);
  return index > 0 ? CAR_CLASSES[index - 1].limit : 0;
}

/**
 * What to call a batch, written the way an entry list would write it.
 *
 * Several classes sharing a batch are named as the one bracket they span — "up to
 * 3000cc" rather than a string of every class inside it, which is both how it would
 * have been printed and short enough to read in a menu.
 */
function rangeLabel(buckets: Bucket[], smallest?: CarClass): string {
  // Nothing in the field runs below the smallest class entered, so the batch holding
  // it reads as an open bracket rather than one bounded from underneath by a class
  // no one is in: "up to 3000cc", not "750–3000cc".
  const from = buckets[0].carClass === smallest ? 0 : lowerLimit(buckets[0].carClass);
  const to = buckets[buckets.length - 1].carClass.limit;

  if (to === Infinity) return from > 0 ? `over ${from}cc` : 'all classes';
  if (from === 0) return `up to ${to}cc`;

  return `${from}–${to}cc`;
}

/** The field by class, smallest engines first, empty classes left out. */
function bucketByClass(opponents: ChampionshipOpponent[]): Bucket[] {
  const byLabel = new Map<string, ChampionshipOpponent[]>();

  for (const opponent of opponents) {
    const label = classOfCar(opponent.car).label;
    const existing = byLabel.get(label);
    if (existing) existing.push(opponent);
    else byLabel.set(label, [opponent]);
  }

  return CAR_CLASSES.filter(carClass => byLabel.has(carClass.label)).map(carClass => ({
    carClass,
    entries: byLabel.get(carClass.label) as ChampionshipOpponent[],
  }));
}

/**
 * Break a class that will not fit the track into batches that will.
 *
 * Sorted by engine size, biggest first, so the split still falls somewhere sensible
 * rather than wherever the roster happened to list people. Batches are evened out —
 * eighteen cars into sixteen boxes goes as nine and nine, not sixteen and two.
 */
function splitClass(bucket: Bucket, capacity: number, smallest?: CarClass): LaunchGroup[] {
  const count = Math.ceil(bucket.entries.length / capacity);
  const ordered = [...bucket.entries].sort((a, b) => {
    const sizeA = displacementOf(a.car) ?? 0;
    const sizeB = displacementOf(b.car) ?? 0;
    if (sizeA !== sizeB) return sizeB - sizeA;
    return a.name.localeCompare(b.name);
  });

  const per = Math.ceil(ordered.length / count);

  return Array.from({ length: count }, (_, index) => ({
    label: `${rangeLabel([bucket], smallest)} (${index + 1} of ${count})`,
    drivers: ordered.slice(index * per, (index + 1) * per).map(entry => entry.name),
  }));
}

/**
 * How a round should be divided to fit `capacity` cars at a time.
 *
 * Returns an empty list when the field already fits, which is the ordinary case and
 * the caller's signal to race the round whole.
 */
export function planClassGroups(
  opponents: ChampionshipOpponent[],
  capacity: number
): LaunchGroup[] {
  if (capacity < 2) return [];
  if (opponents.length <= capacity) return [];

  const buckets = bucketByClass(opponents);
  const smallest = buckets[0]?.carClass;

  const groups: LaunchGroup[] = [];

  let pending: Bucket[] = [];
  let pendingSize = 0;

  const flush = () => {
    if (!pending.length) return;

    groups.push({
      label: rangeLabel(pending, smallest),
      drivers: pending.flatMap(bucket => bucket.entries.map(entry => entry.name)),
    });

    pending = [];
    pendingSize = 0;
  };

  for (const bucket of buckets) {
    // A class bigger than the track has to be broken up, and nothing can share a
    // batch with it, so whatever was waiting goes out first.
    if (bucket.entries.length > capacity) {
      flush();
      groups.push(...splitClass(bucket, capacity, smallest));
      continue;
    }

    if (pendingSize + bucket.entries.length > capacity) flush();

    pending.push(bucket);
    pendingSize += bucket.entries.length;
  }

  flush();

  return groups;
}
