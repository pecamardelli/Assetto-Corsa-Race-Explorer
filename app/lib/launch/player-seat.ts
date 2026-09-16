import { ChampionshipOpponent, Season } from '../../types/race';
import { PlayerProfile, PlayersConfig, activePlayer } from '../../types/player';
import { readPlayers } from '../players';
import { playersSittingOut, seasonPlayers } from '../season-players';
import { readSeasonPlayerNames } from './assists';

/**
 * Which car on the roster the person at the keyboard gets, and whose cars come off it
 * while they are driving.
 *
 * Shared by the launcher and by the route that shows a round's batches, because the
 * grid a menu offers has to be the grid that goes out — a season where one of the
 * seats changes hands would otherwise be proposed one car bigger than it is raced.
 */

/** The entry a launch puts the player in, and the roster seat it was taken from. */
export interface PlayerSeat {
  entry: ChampionshipOpponent;
  /**
   * Set only for a guest: the roster entry the seat was cloned from, which the field
   * gives up for this launch. Null when the player has an entry of their own.
   */
  base: ChampionshipOpponent | null;
}

/**
 * The seat itself.
 *
 * Their own entry, where the `.champ` names them — which is every season built around
 * them, and how it has always worked. A player the season does not know goes out as a
 * guest in somebody else's: they take over another player's seat, with their own name
 * and flag on it, and that player stands down for the round.
 *
 * Cloning a seat rather than inventing one keeps the field the size the season was
 * designed for, and keeps the `.champ` untouched — it belongs to Content Manager, and
 * nothing here ever rewrites it. What car the guest actually drives is settled
 * separately, from their own pick for the season.
 */
export function seatFor(
  opponents: ChampionshipOpponent[],
  driver: PlayerProfile,
  players: PlayersConfig
): PlayerSeat | null {
  const own = opponents.find(entry => entry.name === driver.name);
  if (own) return { entry: own, base: null };

  // "PLAYER" is the .champ's own placeholder for whoever is driving, so it is anyone's
  // to take. Otherwise the seat comes from another player of this install — never from
  // an AI driver, whose entry is their own and not a chair to be borrowed.
  const names = new Set(players.players.map(player => player.name));
  const base =
    opponents.find(entry => entry.name === 'PLAYER') ??
    opponents.find(entry => names.has(entry.name));
  if (!base) return null;

  return {
    entry: { ...base, name: driver.name, nation: driver.nation || base.nation },
    base,
  };
}

export interface SeasonSeating {
  /** Whoever is at the keyboard. */
  driver: PlayerProfile;
  /** Their seat, or null for a season with nobody's seat to give them. */
  seat: PlayerSeat | null;
  /** Roster names left at home because they belong to one of us who is not driving. */
  sittingOut: Set<string>;
  /**
   * The roster as this launch sees it: the guest put in the place of the seat they
   * are standing in, and everybody sitting out taken out.
   */
  roster: ChampionshipOpponent[];
  players: PlayersConfig;
}

/**
 * Work all of that out for one season.
 *
 * `roster` is what every field calculation should start from — the running order, the
 * batches, the grid — so that the person driving is in it exactly once, under their
 * own name, and nobody else's seat is filled by a machine.
 */
export async function seasonSeating(
  champFolder: string,
  seasonFolder: string,
  season: Season,
  /** An explicit driver, for the launcher's AC_PLAYER_NAME override. */
  override?: PlayerProfile
): Promise<SeasonSeating> {
  const players = await readPlayers();
  const driver = override ?? activePlayer(players);

  const seated = seasonPlayers(
    season.sessions,
    await readSeasonPlayerNames(champFolder, seasonFolder),
    players
  );
  const sittingOut = playersSittingOut(seated, driver.name);
  const seat = seatFor(season.data.opponents, driver, players);

  const roster = season.data.opponents
    .map(entry => (seat?.base && entry === seat.base ? seat.entry : entry))
    .filter(entry => entry === seat?.entry || !sittingOut.has(entry.name));

  return { driver, seat, sittingOut, roster, players };
}
