import { promises as fs } from 'fs';
import path from 'path';
import {
  FALLBACK_PLAYER,
  PlayerProfile,
  PlayersConfig,
  activePlayer,
  primaryPlayer,
  sanitizePlayers,
} from '../types/player';

/**
 * Who can take the wheel, and who has it now.
 *
 * Kept in `app/data/players.json` beside the game config rather than among the driver
 * profiles, because it is a setting about this install — which of the people whose
 * profiles are on file is sitting in front of the screen — and not a fact about any
 * driver. The profiles themselves are unchanged: a player is looked up in
 * `app/lib/driver-profiles` by name like every other driver on the grid.
 */

const PLAYERS_FILE = path.join(process.cwd(), 'app', 'data', 'players.json');
const LEGACY_PROFILE = path.join(process.cwd(), 'app', 'lib', 'driver-profiles', 'player.json');

/**
 * The install before it had a players file: one driver, named by the profile the app
 * has always kept for them. Read rather than assumed so an install that never writes
 * a players file goes on behaving exactly as it did.
 */
async function legacyPlayer(): Promise<PlayersConfig | null> {
  try {
    const contents = await fs.readFile(LEGACY_PROFILE, 'utf8');
    const profile = JSON.parse(contents.replace(/^﻿/, '')) as { name?: string };
    if (!profile.name) return null;

    return { active: profile.name, players: [{ name: profile.name, nation: FALLBACK_PLAYER.nation }] };
  } catch {
    return null;
  }
}

/** Every player on this install, and which of them is driving. */
export async function readPlayers(): Promise<PlayersConfig> {
  try {
    const contents = await fs.readFile(PLAYERS_FILE, 'utf8');
    const parsed = sanitizePlayers(JSON.parse(contents.replace(/^﻿/, '')));
    if (parsed) return parsed;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') console.error('Could not read the players file:', error);
  }

  return (
    (await legacyPlayer()) ?? {
      active: FALLBACK_PLAYER.name,
      players: [FALLBACK_PLAYER],
    }
  );
}

export async function writePlayers(config: PlayersConfig): Promise<void> {
  await fs.mkdir(path.dirname(PLAYERS_FILE), { recursive: true });
  await fs.writeFile(PLAYERS_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/** Hand the wheel to somebody else. Returns the config as it now stands. */
export async function setActivePlayer(name: string): Promise<PlayersConfig | null> {
  const config = await readPlayers();
  if (!config.players.some(player => player.name === name)) return null;

  const next = { ...config, active: name };
  await writePlayers(next);
  return next;
}

/** Put a new person on the list. An existing name has its nation updated instead. */
export async function addPlayer(profile: PlayerProfile): Promise<PlayersConfig> {
  const config = await readPlayers();
  const players = config.players.some(player => player.name === profile.name)
    ? config.players.map(player => (player.name === profile.name ? profile : player))
    : [...config.players, profile];

  const next = { ...config, players };
  await writePlayers(next);
  return next;
}

/**
 * Take somebody off the list.
 *
 * The primary stays: they are what every result filed before players existed is read
 * as belonging to, so removing them would re-attribute the entire archive. Whoever is
 * removed while holding the wheel hands it back to the primary.
 */
export async function removePlayer(name: string): Promise<PlayersConfig | null> {
  const config = await readPlayers();
  if (config.players.length <= 1) return null;
  if (primaryPlayer(config).name === name) return null;
  if (!config.players.some(player => player.name === name)) return null;

  const players = config.players.filter(player => player.name !== name);
  const next = {
    active: config.active === name ? players[0].name : config.active,
    players,
  };
  await writePlayers(next);
  return next;
}

/** Whoever is at the keyboard, as a profile. */
export async function readActivePlayer(): Promise<PlayerProfile> {
  return activePlayer(await readPlayers());
}

/** Every player's name, whether or not they are driving right now. */
export async function playerNames(): Promise<Set<string>> {
  const config = await readPlayers();
  return new Set(config.players.map(player => player.name));
}
