import os from 'os';
import path from 'path';

/**
 * Filesystem locations this machine's Assetto Corsa install uses. All of them are
 * overridable so the app still builds on a box without AC on it — nothing here
 * touches the disk until an actual launch is requested.
 */

export const AC_ROOT = process.env.AC_ROOT ?? 'C:\\GAMES\\Assetto Corsa';

export const AC_DOCUMENTS =
  process.env.AC_DOCUMENTS ?? path.join(os.homedir(), 'Documents', 'Assetto Corsa');

export const AC_EXE = path.join(AC_ROOT, 'acs.exe');
export const AC_CONTENT_TRACKS = path.join(AC_ROOT, 'content', 'tracks');
export const AC_CONTENT_WEATHER = path.join(AC_ROOT, 'content', 'weather');

export const AC_CFG_DIR = path.join(AC_DOCUMENTS, 'cfg');
export const RACE_INI = path.join(AC_CFG_DIR, 'race.ini');

/** Single rolling backup of whatever race.ini held before the last launch. */
export const RACE_INI_BACKUP = path.join(AC_CFG_DIR, 'race.ini.bak');

export const AC_OUT_DIR = path.join(AC_DOCUMENTS, 'out');

/** Where the racestats AC app drops one JSON per finished session. */
export const AC_RESULTS_DIR = path.join(AC_OUT_DIR, 'race_statistics');

/**
 * Handshake file read by racestats.py so a saved session knows which round and
 * session type it belongs to. Deliberately outside AC_RESULTS_DIR so it never
 * shows up in the result scan.
 */
export const LAUNCH_CONTEXT_FILE = path.join(AC_OUT_DIR, 'race_explorer_launch.json');
