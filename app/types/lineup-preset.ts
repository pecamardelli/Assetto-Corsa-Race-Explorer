/**
 * Which of a season's roster actually goes out. Client-safe.
 *
 * A .champ lists every driver a season has; a launch does not have to field them all.
 * A road round in traffic with thirteen AI crashing into each other is a different
 * race from one with five, and the choice is the season's to make, once, not the
 * launcher's to guess per round. So a season's presets file may carry a `lineup` with
 * the drivers left out. Stored as exclusions rather than inclusions so a driver added to
 * the .champ later races by default, and an empty list means the whole roster, which is
 * what every season did before this existed.
 *
 * The player is never excluded: AC gives CAR_0 to whoever is at the keyboard, and the
 * season entry for that person is the one thing a launch cannot do without.
 */
export interface LineupConfig {
  /** Roster names that stay home. */
  excluded: string[];
}

export const DEFAULT_LINEUP: LineupConfig = { excluded: [] };

/** Coerce anything read from disk or a request body into a complete config. */
export function sanitizeLineup(input: unknown): LineupConfig {
  const raw = (input ?? {}) as Record<string, unknown>;
  const excluded = Array.isArray(raw.excluded)
    ? Array.from(
        new Set(
          raw.excluded
            .filter((name): name is string => typeof name === 'string')
            .map(name => name.trim())
            .filter(name => name.length > 0)
        )
      )
    : [];
  return { excluded };
}
