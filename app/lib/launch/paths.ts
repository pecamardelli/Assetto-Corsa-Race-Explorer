import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Filesystem locations this machine's Assetto Corsa install uses. All of them are
 * overridable so the app still builds on a box without AC on it — nothing here
 * touches the disk until an actual launch is requested.
 */

/**
 * Where Assetto Corsa is installed, by the name this machine reaches it under.
 *
 * One folder on one disk, but two names for it: Windows mounts the games partition as
 * C:, the Linux side of the same box mounts it under /media. The game only ever runs on
 * Windows, so nothing that writes or launches cares — but the car catalogue is read from
 * whichever side the app is being run from, and a Windows path is not openable from
 * Linux. So the root is the first candidate that is actually on the disk rather than a
 * constant. AC_ROOT overrides the search outright, and when nothing is reachable the
 * Windows path stands, which is what this always was.
 */
const AC_ROOT_CANDIDATES = ['C:\\GAMES\\Assetto Corsa', '/media/pablin/WIN 11/GAMES/Assetto Corsa'];

function findAcRoot(): string {
  if (process.env.AC_ROOT) return process.env.AC_ROOT;

  return AC_ROOT_CANDIDATES.find(root => fs.existsSync(root)) ?? AC_ROOT_CANDIDATES[0];
}

export const AC_ROOT = findAcRoot();

export const AC_DOCUMENTS =
  process.env.AC_DOCUMENTS ?? path.join(os.homedir(), 'Documents', 'Assetto Corsa');

export const AC_EXE = path.join(AC_ROOT, 'acs.exe');
export const AC_CONTENT_CARS = path.join(AC_ROOT, 'content', 'cars');
export const AC_CONTENT_TRACKS = path.join(AC_ROOT, 'content', 'tracks');
export const AC_CONTENT_WEATHER = path.join(AC_ROOT, 'content', 'weather');

export const AC_CFG_DIR = path.join(AC_DOCUMENTS, 'cfg');
export const RACE_INI = path.join(AC_CFG_DIR, 'race.ini');

/** Single rolling backup of whatever race.ini held before the last launch. */
export const RACE_INI_BACKUP = path.join(AC_CFG_DIR, 'race.ini.bak');

/** Driving aids and realism settings; AC reads this next to race.ini at launch. */
export const ASSISTS_INI = path.join(AC_CFG_DIR, 'assists.ini');

/** Same one-deep backup policy as race.ini. */
export const ASSISTS_INI_BACKUP = path.join(AC_CFG_DIR, 'assists.ini.bak');

/** Grid manifest for Il Direttore (ratings above 100, aggression), rewritten each launch. */
export const DIRETTORE_GRID = path.join(AC_CFG_DIR, 'direttore_grid.json');

/**
 * Settings for one of our own traffic modes, which live in the install rather than in
 * Documents. CSP reads the file directly, so the launcher edits it in place to set the
 * traffic car count for a round.
 */
export function trafficModeDir(mode: string): string {
  return path.join(AC_ROOT, 'extension', 'lua', 'new-modes', mode);
}
export function trafficModeSettingsIni(mode: string): string {
  return path.join(trafficModeDir(mode), 'settings.ini');
}

/** Same one-deep backup policy as race.ini and assists.ini. */
export function trafficModeSettingsBackup(mode: string): string {
  return path.join(trafficModeDir(mode), 'settings.ini.bak');
}

export const AC_OUT_DIR = path.join(AC_DOCUMENTS, 'out');

/** Where the racestats AC app drops one JSON per finished session. */
export const AC_RESULTS_DIR = path.join(AC_OUT_DIR, 'race_statistics');

/**
 * Handshake file read by racestats.py so a saved session knows which round and
 * session type it belongs to. Deliberately outside AC_RESULTS_DIR so it never
 * shows up in the result scan.
 */
export const LAUNCH_CONTEXT_FILE = path.join(AC_OUT_DIR, 'race_explorer_launch.json');
