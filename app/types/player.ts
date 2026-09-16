/**
 * The people who actually drive.
 *
 * Every table in this app — a season's standings, the all-time career page, a road
 * series' high-score list — is keyed on the driver's name, and a session records the
 * name Assetto Corsa was given for CAR_0. So a second person at the keyboard needs
 * nothing more than their own name going into `race.ini` and their own seat coming
 * out of the roster: the points then land where they belong on their own.
 *
 * That name is what a player profile is. The rest of a driver's details — nationality,
 * date of birth, portrait, AI rating — already live in `app/lib/driver-profiles`, and
 * are looked up from this name like anyone else's.
 *
 * Client-safe: reading and writing the file lives in `lib/players`.
 */

export interface PlayerProfile {
  /**
   * The driver's name, exactly as their `.champ` entry and their driver profile spell
   * it. This is the join key everywhere, so it is never rewritten or normalised.
   */
  name: string;
  /**
   * Three-letter nation code, for the seasons whose `.champ` has no entry for them:
   * a guest seat has to carry a flag, and there is nowhere else to get one from. A
   * player with a roster entry takes the nation from it instead.
   */
  nation: string;
}

export interface PlayersConfig {
  /** Whoever is at the keyboard now. Every launch, every car pick, reads this. */
  active: string;
  /**
   * Everyone who can take the wheel, in the order they were added. The first is the
   * primary: results filed before player profiles existed are read as theirs, since
   * they were the only person driving when those races were run.
   */
  players: PlayerProfile[];
}

/** What the app falls back to when nothing names a player at all. */
export const FALLBACK_PLAYER: PlayerProfile = { name: 'PLAYER', nation: 'ARG' };

function cleanProfile(input: unknown): PlayerProfile | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;

  const nation = typeof raw.nation === 'string' ? raw.nation.trim().toUpperCase() : '';
  return { name, nation: nation || FALLBACK_PLAYER.nation };
}

/**
 * Coerce anything read from disk or a request body into a usable config, or null
 * where it names nobody at all — which reads as "this install has no players file"
 * rather than as an install with an empty grid.
 *
 * Duplicate names collapse: the name is the identity, and two rows for one driver
 * would give them two seats and two sets of points.
 */
export function sanitizePlayers(input: unknown): PlayersConfig | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const list = Array.isArray(raw.players) ? raw.players : [];

  const players: PlayerProfile[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const profile = cleanProfile(entry);
    if (!profile || seen.has(profile.name)) continue;
    seen.add(profile.name);
    players.push(profile);
  }

  if (players.length === 0) return null;

  // An `active` naming somebody who is not on the list is no answer at all, so the
  // primary takes the wheel rather than the launch failing on a name nothing knows.
  const asked = typeof raw.active === 'string' ? raw.active.trim() : '';
  const active = players.some(player => player.name === asked) ? asked : players[0].name;

  return { active, players };
}

/** Whoever is at the keyboard. */
export function activePlayer(config: PlayersConfig): PlayerProfile {
  return config.players.find(player => player.name === config.active) ?? config.players[0];
}

/**
 * The first player on the list.
 *
 * Results filed before this feature existed do not say who drove them, and the answer
 * is always the same: the one person who had been driving all along. See
 * `sessionPlayer` in `lib/season-players`.
 */
export function primaryPlayer(config: PlayersConfig): PlayerProfile {
  return config.players[0];
}
