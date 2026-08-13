import { spawn, execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { buildAssistsIni, pinSeasonAssists } from './assists';
import { ingestResults, listResultFiles } from './ingest';
import { LaunchPlan } from './plan';
import { buildRaceIni, LaunchMode, MODE_SESSIONS } from './race-ini';
import {
  AC_EXE,
  AC_OUT_DIR,
  AC_ROOT,
  ASSISTS_INI,
  ASSISTS_INI_BACKUP,
  LAUNCH_CONTEXT_FILE,
  RACE_INI,
  RACE_INI_BACKUP,
} from './paths';

const execFileAsync = promisify(execFile);

export type LaunchStatus = 'running' | 'completed' | 'failed';

export interface LaunchState {
  id: string;
  status: LaunchStatus;
  mode: LaunchMode;
  champId: string;
  seasonId: string;
  roundNumber: number;
  trackLabel: string;
  startedAt: number;
  finishedAt?: number;
  exitCode?: number | null;
  error?: string;
  /** False for a run driven for its own sake, whose sessions are never filed. */
  recorded: boolean;
  /** Result files moved into the season folder once AC quit. */
  ingested?: string[];
  /** Sessions AC wrote that were left unfinished, and so not filed. */
  skipped?: number;
}

// Held on globalThis so a dev-server hot reload does not lose track of a race that
// is still running.
const store = globalThis as typeof globalThis & { __acLaunch?: LaunchState | null };

export function currentLaunch(): LaunchState | null {
  return store.__acLaunch ?? null;
}

export class LaunchError extends Error {}

/** True while our own launch is live, or while any acs.exe is up. */
async function assettoCorsaIsRunning(): Promise<boolean> {
  if (store.__acLaunch?.status === 'running') return true;

  try {
    const { stdout } = await execFileAsync('tasklist', [
      '/FI',
      'IMAGENAME eq acs.exe',
      '/NH',
    ]);
    return stdout.toLowerCase().includes('acs.exe');
  } catch {
    // tasklist is a nicety; our own state is the real guard.
    return false;
  }
}

/** Keep exactly one backup: whatever the file held before this launch. */
async function backupCfgFile(source: string, backup: string): Promise<void> {
  try {
    await fs.copyFile(source, backup);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // Nothing to preserve on a machine that has never run a race.
    if (code !== 'ENOENT') throw error;
  }
}

/**
 * Tells racestats.py what it is recording. `sessions` names each save in the order
 * AC runs them, and the two targets are how the app decides whether a session
 * reached its natural end — AC's own session state is only in shared memory, which
 * its embedded Python cannot reach for want of a ctypes module.
 */
async function writeLaunchContext(plan: LaunchPlan, id: string): Promise<void> {
  const context = {
    launch_id: id,
    sessions: MODE_SESSIONS[plan.spec.mode],
    laps: plan.spec.race.laps,
    qualifying_minutes: plan.spec.race.qualifyingMinutes,
    championship: plan.championshipName,
    season: plan.seasonFolder,
    round: plan.roundNumber,
    track: plan.roundTrack,
    // Recorded so the session stats can carry the presets they were driven with.
    assists: plan.assists,
  };

  await fs.mkdir(AC_OUT_DIR, { recursive: true });
  await fs.writeFile(LAUNCH_CONTEXT_FILE, JSON.stringify(context, null, 2), 'utf8');
}

async function finish(
  state: LaunchState,
  plan: LaunchPlan,
  exitCode: number | null,
  preexisting: Set<string>
) {
  state.exitCode = exitCode;
  state.finishedAt = Date.now();

  if (!plan.record) {
    // Whatever AC wrote is left in its out folder rather than deleted, the same
    // way an unfinished session is — it is simply not this season's business.
    state.ingested = [];
    state.status = 'completed';
    await fs.rm(LAUNCH_CONTEXT_FILE, { force: true }).catch(() => {});
    return;
  }

  try {
    const outcome = await ingestResults(plan, state.startedAt, preexisting);
    state.ingested = outcome.filed;
    state.skipped = outcome.skipped;
    state.status = 'completed';
  } catch (error) {
    state.status = 'failed';
    state.error = `Assetto Corsa exited but results could not be filed: ${String(error)}`;
  }

  await fs.rm(LAUNCH_CONTEXT_FILE, { force: true }).catch(() => {});
}

/**
 * Write the session out, start the game, and file the results when it quits.
 * Returns as soon as the process is up — callers poll `currentLaunch()`.
 */
export async function launch(
  plan: LaunchPlan,
  champId: string,
  seasonId: string
): Promise<LaunchState> {
  if (await assettoCorsaIsRunning()) {
    throw new LaunchError('Assetto Corsa is already running');
  }

  if (!(await fs.stat(AC_EXE).catch(() => null))) {
    throw new LaunchError(`Could not find acs.exe at ${AC_EXE} — set AC_ROOT`);
  }

  const id = randomUUID();

  await backupCfgFile(RACE_INI, RACE_INI_BACKUP);
  await fs.writeFile(RACE_INI, buildRaceIni(plan.spec), 'utf8');

  await backupCfgFile(ASSISTS_INI, ASSISTS_INI_BACKUP);
  await fs.writeFile(ASSISTS_INI, buildAssistsIni(plan.assists), 'utf8');

  // A season launching on the global config gets its own copy filed away, so the
  // data folder always records what each season was driven with.
  await pinSeasonAssists(plan.championshipName, plan.seasonFolder, plan.assists);

  await writeLaunchContext(plan, id);

  // Whatever is sitting in AC's out folder now was not written by this launch, so
  // it is off limits when the results are filed away afterwards.
  const preexisting = await listResultFiles();

  const state: LaunchState = {
    id,
    status: 'running',
    mode: plan.spec.mode,
    champId,
    seasonId,
    roundNumber: plan.roundNumber,
    trackLabel: plan.trackLabel,
    recorded: plan.record,
    startedAt: Date.now(),
  };

  store.__acLaunch = state;

  const child = spawn(AC_EXE, [], { cwd: AC_ROOT, stdio: 'ignore', windowsHide: false });

  child.on('error', error => {
    state.status = 'failed';
    state.error = String(error);
    state.finishedAt = Date.now();
  });

  child.on('exit', code => {
    void finish(state, plan, code, preexisting);
  });

  return state;
}
