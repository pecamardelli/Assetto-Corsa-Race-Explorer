import { RaceSession } from '../types/race';
import { PlayersConfig, primaryPlayer } from '../types/player';

/**
 * Which player drove which session, and which players a season has actually seated.
 *
 * Two questions, one idea behind both: a *player* is a person at the keyboard, and
 * only one person can be at the keyboard at a time. That rule is what lets two
 * brothers share a championship without either of them turning into a bot.
 *
 *
 * ## Who drove a session
 *
 * The launcher stamps `session_info.player` on everything it files. Results filed
 * before that existed do not say, and do not need to: there was one person driving
 * this install then, and that is the primary player. Guessing from the classification
 * would be worse than useless — "Fernando Camardelli" appears in nine seasons of
 * results as an AI driver, and reading those as races he drove would hand him a career
 * he never had.
 *
 *
 * ## Who a season has seated
 *
 * A player is *seated* in a season once they have driven a round of it, or once they
 * have picked a car or set their aids for it. That, and only that, is when the rule
 * "a player profile is never raced by the AI" starts to apply to them there.
 *
 * The distinction matters because a player profile and an AI driver are the same kind
 * of thing on a roster. Fernando Camardelli has raced nine seasons as an AI — the
 * 1920s and 1930s series, the Supercars Trophy, the Campeonato Argentino — and making
 * him a player must not empty his seat in any of them. So he keeps racing those until
 * the day he actually drives one, and from that day the seat is his in person.
 */

/** The player a session's result belongs to. */
export function sessionPlayer(session: RaceSession, players: PlayersConfig): string {
  const stamped = session.data.session_info.player;
  if (typeof stamped === 'string' && stamped.trim()) return stamped.trim();

  return primaryPlayer(players).name;
}

/**
 * The players a season has seated, by the two things that seat them: a result they
 * drove, and a preset they saved for it.
 *
 * `saved` is the key list of the presets file's `players` object — see
 * `lib/launch/assists`. Names that are not players at all are ignored, so a stale
 * preset left behind by somebody taken off the list cannot bench a driver.
 */
export function seasonPlayers(
  sessions: RaceSession[],
  saved: Iterable<string>,
  players: PlayersConfig
): Set<string> {
  const known = new Set(players.players.map(player => player.name));
  const seated = new Set<string>();

  for (const session of sessions) {
    const name = sessionPlayer(session, players);
    if (known.has(name)) seated.add(name);
  }

  for (const name of saved) {
    if (known.has(name)) seated.add(name);
  }

  return seated;
}

/**
 * The roster names a launch must leave out because they belong to somebody else's
 * hands: every seated player except the one driving.
 *
 * The driver is never in it — a launch cannot do without its own seat — and neither
 * is a player the season has never seated, who is still just another name on the
 * roster and races as the AI has always raced them.
 */
export function playersSittingOut(
  seated: ReadonlySet<string>,
  driving: string
): Set<string> {
  return new Set([...seated].filter(name => name !== driving));
}

/** The sessions one player drove, in the order they were filed. */
export function sessionsDrivenBy(
  sessions: RaceSession[],
  players: PlayersConfig,
  name: string
): RaceSession[] {
  return sessions.filter(session => sessionPlayer(session, players) === name);
}
