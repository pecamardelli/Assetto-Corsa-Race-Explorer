/**
 * The car the player takes out for a season. Client-safe: reading and writing it lives
 * in `lib/launch/assists` beside the season's other presets.
 *
 * A `.champ` gives every entry a car, the player's included, and for a championship
 * that is the right place for it — a season of the World Sportscar Championship is the
 * cars as much as the drivers, and swapping one out mid-season would make nonsense of
 * the constructors' table.
 *
 * A road series in the Test Drive mode is the other thing. There is no constructors'
 * table, the field is whatever turned up, and which car you drive down the Pacific Coast
 * Highway is the whole question the series asks. So a season may name a car for the
 * player, over the one its `.champ` gives them, and every round of that season is driven
 * in it. Season-scoped rather than per-round on purpose: a Challenge is one road trip,
 * and a table where the leader changed car at every round is not a championship.
 *
 * Stored as an override rather than written back into the `.champ`, which belongs to
 * Content Manager and is never rewritten — the same rule the race settings follow. No
 * override, and the player drives what the `.champ` entered them in, exactly as before.
 */
export interface PlayerCarConfig {
  /** Folder name under content/cars. */
  car: string;
  /** Livery folder under that car's `skins/`; empty leaves AC to pick one. */
  skin: string;
}

/**
 * Coerce anything read from disk or a request body into a pick, or null where there
 * isn't one. A pick with no car is not a pick — it is the absence of one, and reads
 * back as the season following its `.champ`.
 */
export function sanitizePlayerCar(input: unknown): PlayerCarConfig | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const car = typeof raw.car === 'string' ? raw.car.trim() : '';
  if (!car) return null;

  const skin = typeof raw.skin === 'string' ? raw.skin.trim() : '';
  return { car, skin };
}
