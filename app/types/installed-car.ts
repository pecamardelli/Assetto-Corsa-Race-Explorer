/**
 * A car as the Assetto Corsa install describes it, and the handful of things worth
 * deriving from that description. Client-safe — the scan itself lives in
 * `lib/launch/car-catalog`.
 *
 * Everything here comes out of the car's own `ui/ui_car.json`, which is authored by
 * whoever built the car and is therefore uneven: `class` is free text and runs to forty
 * spellings across an install ("street", "Street", "street/trackday", "Supercars",
 * "GP '39"), `specs` are display strings with their units baked in ("442bhp", "1490kg"),
 * and a mod may leave any of it out. So the shape below keeps the raw values for
 * display and adds parsed numbers and two normalised facets beside them, which is what
 * a filter can actually work on. Anything unstated is null rather than zero: a car with
 * no top speed on file is not a car with a top speed of nothing.
 */

/** One livery: the folder under the car's `skins/`, and the name its ui_skin.json gives. */
export interface InstalledSkin {
  id: string;
  name: string;
}

/** Which wheels are driven, where the car's tags say. */
export type Drivetrain = 'fwd' | 'rwd' | 'awd';

/**
 * The one division of an install that holds across every author's naming: is this a car
 * you could drive on a road, or one built to race? Derived rather than read, because
 * `class` alone does not answer it — see {@link carKind}.
 */
export type CarKind = 'street' | 'race' | 'other';

export interface InstalledCar {
  /** Folder name under content/cars — what a .champ entry's `car` is. */
  id: string;
  name: string;
  brand: string;
  /** The car's own class, as its author typed it. Shown, never grouped on. */
  carClass: string;
  year: number | null;
  tags: string[];
  /** The ui_car.json specs block untouched: bhp, torque, weight, topspeed, ... */
  specs: Record<string, string>;
  /** Parsed out of those specs for filtering and sorting; null where unstated. */
  bhp: number | null;
  weightKg: number | null;
  topSpeedKmh: number | null;
  drivetrain: Drivetrain | null;
  kind: CarKind;
  /** How many liveries it ships; the liveries themselves are asked for per car. */
  skinCount: number;
  /** The livery a pick defaults to: the first folder, as AC itself lists them. */
  defaultSkin: string;
}

/** Tags carry the drivetrain, in whatever case the author felt like. */
export function drivetrainOf(tags: string[]): Drivetrain | null {
  const lower = new Set(tags.map(tag => tag.toLowerCase().trim()));
  if (lower.has('awd') || lower.has('4wd')) return 'awd';
  if (lower.has('fwd')) return 'fwd';
  if (lower.has('rwd')) return 'rwd';
  return null;
}

/**
 * Street or race.
 *
 * The tags answer it where they are present and the class does not: a car whose class
 * reads "Supercars" or "GP '39" says nothing about which of the two it is, but almost
 * every car carries a `street` or `race` tag as well. So the tags are asked first, the
 * class second, and a car that answers to neither is left as 'other' rather than
 * guessed at — an install has a few dozen of those and hiding them behind a wrong
 * filter is worse than showing them under their own.
 */
export function carKind(carClass: string, tags: string[]): CarKind {
  const lower = new Set(tags.map(tag => tag.toLowerCase().trim()));
  if (lower.has('street')) return 'street';
  if (lower.has('race') || lower.has('racing')) return 'race';

  const declared = carClass.toLowerCase().trim();
  if (declared.startsWith('street')) return 'street';
  if (declared === 'race' || declared === 'racing') return 'race';

  return 'other';
}

export const CAR_KIND_LABELS: Record<CarKind, string> = {
  street: 'Road',
  race: 'Race',
  other: 'Other',
};

export const DRIVETRAIN_LABELS: Record<Drivetrain, string> = {
  fwd: 'FWD',
  rwd: 'RWD',
  awd: 'AWD',
};

/**
 * The leading number of a spec string, converted to the unit we compare in.
 *
 * A spec is a display string with its unit inside it, and the unit is not fixed: a mod
 * may quote weight in pounds or a top speed in mph. Reading the number and ignoring
 * what follows it would put a 2400 lb car above a 1490 kg one, so the suffix decides
 * the conversion. Decimal commas are read as decimal points, which is how several
 * Italian-authored cars write a power-to-weight ratio.
 */
function specNumber(value: string | undefined, imperial?: { match: RegExp; factor: number }): number | null {
  if (!value) return null;

  const match = /-?\d+(?:[.,]\d+)?/.exec(value);
  if (!match) return null;

  const parsed = Number(match[0].replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return imperial && imperial.match.test(value) ? parsed * imperial.factor : parsed;
}

export function parseBhp(specs: Record<string, string>): number | null {
  // "kW" is the one unit that is not a horsepower of some kind; the rest (bhp, hp, cv,
  // ps) differ by a couple of percent and are not worth pretending to tell apart.
  return specNumber(specs.bhp, { match: /kw/i, factor: 1.341 });
}

export function parseWeightKg(specs: Record<string, string>): number | null {
  return specNumber(specs.weight, { match: /lb/i, factor: 0.4536 });
}

export function parseTopSpeedKmh(specs: Record<string, string>): number | null {
  return specNumber(specs.topspeed, { match: /mph/i, factor: 1.609 });
}

/** bhp per tonne, for sorting on the number that actually decides the pace. */
export function powerToWeight(car: InstalledCar): number | null {
  if (car.bhp === null || car.weightKg === null || car.weightKg <= 0) return null;
  return (car.bhp / car.weightKg) * 1000;
}

/** The decade a car belongs to, as a label: 1987 -> "1980s". Null for an undated car. */
export function decadeOf(year: number | null): string | null {
  if (year === null || year < 1800 || year > 2200) return null;
  return `${Math.floor(year / 10) * 10}s`;
}
