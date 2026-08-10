import { promises as fs } from 'fs';
import path from 'path';
import { RaceData } from '../../types/race';
import { AC_RESULTS_DIR } from './paths';
import { LaunchPlan } from './plan';
import { MODE_SESSIONS, SessionType } from './race-ini';

/**
 * racestats.py writes one JSON per finished session into AC's out folder. Once the
 * game exits, anything it dropped during this launch belongs to the round we
 * started, so it gets stamped, renamed to the season's convention and moved in.
 */

/** Clock skew guard so a file saved a moment before spawn still counts. */
const MTIME_GRACE_MS = 60_000;

const SESSION_TYPES: SessionType[] = ['practice', 'qualifying', 'race'];

/**
 * The AC app writes an empty string, not a missing key, when it could not work out
 * which session it recorded — so absence has to be tested by value.
 */
function knownSessionType(value: unknown): SessionType | null {
  return SESSION_TYPES.includes(value as SessionType) ? (value as SessionType) : null;
}

function timestampFrom(date: string | undefined, fallback: Date): string {
  const parsed = date ? new Date(date.replace(' ', 'T')) : new Date(NaN);
  const when = Number.isNaN(parsed.getTime()) ? fallback : parsed;

  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}` +
    `_${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`
  );
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Never clobber an existing result; suffix until the name is free. */
async function uniquePath(dir: string, base: string): Promise<string> {
  let candidate = path.join(dir, `${base}.json`);
  let counter = 2;

  while (await exists(candidate)) {
    candidate = path.join(dir, `${base}_${counter}.json`);
    counter += 1;
  }

  return candidate;
}

/**
 * Move every result written since `since` into the season folder.
 * Returns the names it filed, in the order it found them.
 */
export async function ingestResults(plan: LaunchPlan, since: number): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(AC_RESULTS_DIR);
  } catch {
    return [];
  }

  const expectedSessions = MODE_SESSIONS[plan.spec.mode];
  const seasonDir = path.join(
    process.cwd(),
    'app',
    'data',
    'championship',
    plan.championshipName,
    plan.seasonFolder
  );

  const candidates: Array<{ source: string; mtime: number }> = [];

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;

    const source = path.join(AC_RESULTS_DIR, entry);
    const stats = await fs.stat(source).catch(() => null);
    if (!stats || stats.mtimeMs < since - MTIME_GRACE_MS) continue;

    candidates.push({ source, mtime: stats.mtimeMs });
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => a.mtime - b.mtime);
  await fs.mkdir(seasonDir, { recursive: true });

  const filed: string[] = [];

  for (const [index, { source, mtime }] of candidates.entries()) {
    try {
      const data = JSON.parse(await fs.readFile(source, 'utf8')) as RaceData;

      // The AC app reads the live session out of shared memory, so its own label is
      // the one to trust. Falling back on the launch's session order covers a run
      // where shared memory was not available.
      const sessionType: SessionType =
        knownSessionType(data.session_info.session_type) ??
        expectedSessions[index] ??
        expectedSessions[expectedSessions.length - 1];

      data.session_info = {
        ...data.session_info,
        session_type: sessionType,
        // A session the driver quit out of is kept, but never passes as complete.
        finished: data.session_info.finished ?? false,
      };

      // Name from the round, not from the file: the season page pairs sessions to
      // rounds by looking for the round's track string in the filename.
      const stamp = timestampFrom(data.session_info.date, new Date(mtime));
      const target = await uniquePath(
        seasonDir,
        `stats_${plan.roundTrack}_session_${sessionType}_${stamp}`
      );

      await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
      await fs.rm(source, { force: true });

      filed.push(path.basename(target));
    } catch (error) {
      console.error(`Could not ingest ${source}:`, error);
    }
  }

  return filed;
}
