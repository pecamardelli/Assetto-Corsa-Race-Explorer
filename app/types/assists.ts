/**
 * The game presets AC reads from cfg/assists.ini at launch. Client-safe: the
 * filesystem side (loading, merging, writing the ini) lives in lib/launch/assists.
 */

/** ABS and traction control: off entirely, per-car ("factory"), or forced on. */
export type AssistLevel = 'off' | 'factory' | 'on';

export const ASSIST_LEVELS: AssistLevel[] = ['off', 'factory', 'on'];

export interface AssistsConfig {
  autoShifter: boolean;
  autoClutch: boolean;
  /** Automatic throttle blip on downshifts. */
  autoBlip: boolean;
  autoBrake: boolean;
  idealLine: boolean;
  abs: AssistLevel;
  tractionControl: AssistLevel;
  /** 0–100%. */
  stabilityControl: number;
  /** Mechanical damage, 0–100%. */
  damage: number;
  visualDamage: boolean;
  /** Consumption multiplier: 0 = off, 1 = realistic. */
  fuelRate: number;
  /** Wear multiplier: 0 = off, 1 = realistic. */
  tyreWear: number;
  tyreBlankets: boolean;
  /** Effect multiplier: 0 = off, 1 = realistic. */
  slipstream: number;
}

/**
 * Matches what cfg/assists.ini held on this machine before the app took the file
 * over, so a launch with no saved config behaves exactly as launches always did.
 */
export const DEFAULT_ASSISTS: AssistsConfig = {
  autoShifter: true,
  autoClutch: true,
  autoBlip: true,
  autoBrake: false,
  idealLine: true,
  abs: 'on',
  tractionControl: 'on',
  stabilityControl: 100,
  damage: 0,
  visualDamage: false,
  fuelRate: 0,
  tyreWear: 0,
  tyreBlankets: true,
  slipstream: 0,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function level(value: unknown, fallback: AssistLevel): AssistLevel {
  return ASSIST_LEVELS.includes(value as AssistLevel) ? (value as AssistLevel) : fallback;
}

/**
 * Coerce anything read from disk or a request body into a complete config.
 * Field-by-field so a file from an older version keeps its known values.
 */
export function sanitizeAssists(input: unknown): AssistsConfig {
  const raw = (input ?? {}) as Record<string, unknown>;

  return {
    autoShifter: bool(raw.autoShifter, DEFAULT_ASSISTS.autoShifter),
    autoClutch: bool(raw.autoClutch, DEFAULT_ASSISTS.autoClutch),
    autoBlip: bool(raw.autoBlip, DEFAULT_ASSISTS.autoBlip),
    autoBrake: bool(raw.autoBrake, DEFAULT_ASSISTS.autoBrake),
    idealLine: bool(raw.idealLine, DEFAULT_ASSISTS.idealLine),
    abs: level(raw.abs, DEFAULT_ASSISTS.abs),
    tractionControl: level(raw.tractionControl, DEFAULT_ASSISTS.tractionControl),
    stabilityControl: clamp(raw.stabilityControl, DEFAULT_ASSISTS.stabilityControl, 0, 100),
    damage: clamp(raw.damage, DEFAULT_ASSISTS.damage, 0, 100),
    visualDamage: bool(raw.visualDamage, DEFAULT_ASSISTS.visualDamage),
    fuelRate: clamp(raw.fuelRate, DEFAULT_ASSISTS.fuelRate, 0, 5),
    tyreWear: clamp(raw.tyreWear, DEFAULT_ASSISTS.tyreWear, 0, 5),
    tyreBlankets: bool(raw.tyreBlankets, DEFAULT_ASSISTS.tyreBlankets),
    slipstream: clamp(raw.slipstream, DEFAULT_ASSISTS.slipstream, 0, 5),
  };
}

/** Where an effective config came from, for labelling in the UI. */
export type AssistsSource = 'global' | 'season';
