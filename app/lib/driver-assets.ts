import { promises as fs } from 'fs';
import path from 'path';

export type DriverProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  features: string;
  gender: string;
  isFictional?: boolean;
  bio?: string;
  // Reference date for age display. Set on a championship override so a driver
  // in a period series reads their in-era age instead of one measured from today.
  ageAsOf?: string;
  // AI strength this driver races at when a session is launched from the app.
  // Absent means 100. Set it on a championship override to make one driver a
  // sharper opponent in that series without touching their base profile.
  skill?: number;
};

const PORTRAIT_DIR = 'driver-portraits';
const PROFILE_DIR = 'app/lib/driver-profiles';

// Precedence when a driver has more than one file. Kept png-first to match the
// previous behaviour and so a freshly generated portrait (the ComfyUI route writes
// .png) still wins over an older .webp. Probing is a local fs.access now, so the
// order costs nothing.
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

// Per-series defaults, merged under each driver's own override.
const SERIES_DEFAULTS = '_defaults';

export function driverSlug(driverName: string): string {
  return driverName.replace(/ /g, '_').toLowerCase();
}

export function championshipSlug(championship: string): string {
  return championship
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function publicUrl(segments: string[]): string {
  return '/' + segments.map(encodeURIComponent).join('/');
}

async function findPortrait(dirSegments: string[], slug: string): Promise<string | null> {
  for (const ext of IMAGE_EXTENSIONS) {
    const segments = [...dirSegments, `${slug}.${ext}`];
    try {
      await fs.access(path.join(process.cwd(), 'public', ...segments));
      return publicUrl(segments);
    } catch {
      // try the next extension
    }
  }
  return null;
}

/**
 * Resolve a driver's portrait to a concrete URL, preferring a championship-specific
 * portrait when one exists. Returns null when the driver has no portrait at all,
 * which is the caller's cue to render a placeholder.
 */
export async function resolveDriverPortrait(
  driverName: string,
  championship?: string
): Promise<string | null> {
  const slug = driverSlug(driverName);

  if (championship) {
    const override = await findPortrait([PORTRAIT_DIR, championshipSlug(championship)], slug);
    if (override) return override;
  }

  return findPortrait([PORTRAIT_DIR], slug);
}

/** Resolve many portraits at once, returning a name -> URL map. */
export async function resolveDriverPortraits(
  driverNames: string[],
  championship?: string
): Promise<Map<string, string | null>> {
  const unique = [...new Set(driverNames)];
  const resolved = await Promise.all(
    unique.map(name => resolveDriverPortrait(name, championship))
  );
  return new Map(unique.map((name, i) => [name, resolved[i]]));
}

async function readProfile(...segments: string[]): Promise<Partial<DriverProfile> | null> {
  try {
    const contents = await fs.readFile(path.join(process.cwd(), ...segments), 'utf8');
    return JSON.parse(contents);
  } catch {
    return null;
  }
}

/**
 * Load a driver's profile, layering any championship-specific override on top of
 * the base profile. Overrides may be partial: whatever they omit is inherited.
 *
 * Precedence: base profile < series _defaults.json < the driver's own override.
 */
export async function getDriverProfile(
  driverName: string,
  championship?: string
): Promise<DriverProfile | null> {
  const slug = driverSlug(driverName);
  const base = await readProfile(PROFILE_DIR, `${slug}.json`);

  let defaults: Partial<DriverProfile> | null = null;
  let override: Partial<DriverProfile> | null = null;

  if (championship) {
    const champDir = championshipSlug(championship);
    [defaults, override] = await Promise.all([
      readProfile(PROFILE_DIR, champDir, `${SERIES_DEFAULTS}.json`),
      readProfile(PROFILE_DIR, champDir, `${slug}.json`),
    ]);
  }

  if (!base && !override) return null;

  return {
    ...(base ?? {}),
    ...(defaults ?? {}),
    ...(override ?? {}),
    // The name is the join key everywhere else, so never let an override change it.
    name: base?.name ?? driverName,
  } as DriverProfile;
}

/** Load many profiles at once, returning a name -> profile map. */
export async function getDriverProfiles(
  driverNames: string[],
  championship?: string
): Promise<Map<string, DriverProfile | null>> {
  const unique = [...new Set(driverNames)];
  const resolved = await Promise.all(
    unique.map(name => getDriverProfile(name, championship))
  );
  return new Map(unique.map((name, i) => [name, resolved[i]]));
}

/**
 * Age in whole years. Measured against `asOf` when the profile carries one, so a
 * period driver reads their in-era age rather than one counted from today.
 */
export function calculateAge(dateOfBirth: string, asOf?: string): number {
  const reference = asOf ? new Date(asOf) : new Date();
  const birthDate = new Date(dateOfBirth);

  let age = reference.getFullYear() - birthDate.getFullYear();
  const monthDiff = reference.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/** Age for a profile, honouring any `ageAsOf` its championship override supplied. */
export function profileAge(profile: Pick<DriverProfile, 'dateOfBirth' | 'ageAsOf'>): number | null {
  if (!profile.dateOfBirth) return null;
  return calculateAge(profile.dateOfBirth, profile.ageAsOf);
}
