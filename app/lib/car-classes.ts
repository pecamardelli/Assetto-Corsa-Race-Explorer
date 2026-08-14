import { getCarData } from './car-data';

/**
 * Engine size, and the classes the period drew around it.
 *
 * Assetto Corsa has no idea how big an engine is — it models a torque curve and
 * nothing else, so `engine.ini` carries no swept volume at all. Displacement is
 * therefore authored, and lives in each car's `specs.displacement` in cc.
 *
 * The brackets below are the ones the Mille Miglia and the Targa ran to through the
 * nineteen-thirties: a 1100 was never asked to beat a 2900, it was asked to beat the
 * other 1100s. They are what a round splits along when it is too big for its track.
 */

export interface CarClass {
  /** Largest engine the class admits, in cc. Infinity for the unlimited class. */
  limit: number;
  /** How the class is written on an entry list. */
  label: string;
}

export const CAR_CLASSES: CarClass[] = [
  { limit: 750, label: 'up to 750cc' },
  { limit: 1100, label: '750–1100cc' },
  { limit: 1500, label: '1100–1500cc' },
  { limit: 2000, label: '1500–2000cc' },
  { limit: 3000, label: '2000–3000cc' },
  { limit: Infinity, label: 'over 3000cc' },
];

/** Where a car with no displacement on file is put: the unlimited class. */
const UNKNOWN_CLASS = CAR_CLASSES[CAR_CLASSES.length - 1];

/** Swept volume in cc, or null when the car's specs do not record it. */
export function displacementOf(car: string): number | null {
  const value = getCarData(car)?.specs?.displacement;
  const cc = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : Number(value);

  return Number.isFinite(cc) && cc > 0 ? cc : null;
}

/**
 * The class an engine of this size runs in.
 *
 * A car whose displacement was never filled in lands in the unlimited class rather
 * than in a class of its own: it keeps the field whole, and puts the car among the
 * machinery it is least likely to be embarrassed by.
 */
export function classOf(displacement: number | null): CarClass {
  if (displacement === null) return UNKNOWN_CLASS;

  return CAR_CLASSES.find(entry => displacement <= entry.limit) ?? UNKNOWN_CLASS;
}

/** The class a car runs in, straight from its name. */
export function classOfCar(car: string): CarClass {
  return classOf(displacementOf(car));
}
