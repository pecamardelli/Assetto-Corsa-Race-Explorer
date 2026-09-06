import { spawn, execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { installAiLine } from './ai-line';
import { buildAssistsIni, pinSeasonAssists, pinSeasonTraffic } from './assists';
import { ingestResults, listResultFiles } from './ingest';
import { LaunchPlan } from './plan';
import { buildRaceIni, LaunchMode, MODE_SESSIONS } from './race-ini';
import { buildDirettoreManifest } from './direttore-manifest';
import { setTrafficCars, setTrafficDensity } from './traffic-mode';
import {
  AC_EXE,
  AC_OUT_DIR,
  AC_ROOT,
  ASSISTS_INI,
  ASSISTS_INI_BACKUP,
  DIRETTORE_GRID,
  LAUNCH_CONTEXT_FILE,
  RACE_INI,
  RACE_INI_BACKUP,
  trafficModeSettingsBackup,
  trafficModeSettingsIni,
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
  /** The batch of the round this launch is running, when it is running one. */
  group?: string;
  /**
   * True when CAR_0 is a driver the player is standing in for, because this group
   * is not one they are entered in. Hand the car to the AI once the session loads.
   */
  aiSeat?: boolean;
  startedAt: number;
  finishedAt?: number;
  exitCode?: number | null;
  error?: string;
  /** False for a run driven for its own sake, whose sessions are never filed. */
  recorded: boolean;
  /**
   * Which AI line was installed for this launch, on a track that keeps more than one.
   * Unset when the track has a single line, which is nearly all of them.
   */
  aiLine?: 'road' | 'racing';
  /** Traffic cars this launch put on the road, on a round that has script traffic. */
  trafficCars?: number;
  /** The fleet the road was cast with, when the fleet table named one. */
  trafficFleet?: string;
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
 * Set the car count and the cast list on the traffic mode this round is raced in.
 *
 * The mode reads its settings from its own folder in the install, so this edits a file
 * that is not ours and belongs to a live mod. It rewrites exactly one key and leaves the
 * rest of the file alone, because the other settings there are hand-tuned and several of
 * them are load-bearing. A missing file means the mode is not installed, which the
 * launch will fail on for its own reasons - not worth creating one from nothing here.
 */
async function writeTrafficSettings(mode: string, cars: number, fleetSpec: string): Promise<void> {
  const settingsIni = trafficModeSettingsIni(mode);
  let existing: string;
  try {
    existing = await fs.readFile(settingsIni, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
    console.error(`No ${mode} settings at ${settingsIni} - traffic count left unset`);
    return;
  }

  await backupCfgFile(settingsIni, trafficModeSettingsBackup(mode));
  // The fleet is written even when empty: a round with no cast must not inherit the
  // previous round's, and empty is the mode's "every model".
  const next = setTrafficCars(setTrafficDensity(existing, cars), fleetSpec);
  await fs.writeFile(settingsIni, next, 'utf8');
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
    group: plan.group ?? null,
    track: plan.roundTrack,
    // A Test Drive launch: AC's own lap counter is dead there (every respawn resets a
    // car's lap), so racestats ranks the race by the laps it counted itself instead of
    // AC's leaderboard. The traffic-race mode never moves a car, so AC's own results
    // stand there as in any ordinary race.
    traffic: plan.spec.customMode === 'test-drive',
    // Recorded so the session stats can carry the presets they were driven with.
    assists: plan.assists,
    traffic_cars: plan.traffic?.cars ?? null,
    traffic_fleet: plan.trafficFleet?.fleet ?? null,
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

  // A track that keeps both a racing line and a road line races on the racing line,
  // whatever the round. The road line used to be installed for traffic rounds; since
  // 2026-09-05 the Test Drive mode drives the track's own spline and dodges traffic
  // from there (Pablin: "leave the original AI spline"), so the swap only undid that --
  // the 16:09 New Forest race ran on the centred road line without anyone asking for it.
  // Asking for the racing line also puts it back wherever an earlier launch left the
  // road line installed. Left alone entirely when the track keeps only one line, which
  // is nearly every track.
  const aiLine = await installAiLine(plan.spec.track, plan.spec.trackConfig, false);

  await backupCfgFile(RACE_INI, RACE_INI_BACKUP);
  await fs.writeFile(RACE_INI, buildRaceIni(plan.spec), 'utf8');

  await backupCfgFile(ASSISTS_INI, ASSISTS_INI_BACKUP);
  await fs.writeFile(ASSISTS_INI, buildAssistsIni(plan.assists), 'utf8');

  // Only a round in the Test Drive mode has script traffic, and only then is the
  // mode's own settings file ours to touch.
  if (plan.traffic && plan.spec.customMode) {
    await writeTrafficSettings(plan.spec.customMode, plan.traffic.cars, plan.trafficFleet?.spec ?? '');
  }

  // Il Direttore reads this at load: the ratings above 100 that race.ini cannot
  // carry, and each driver's aggression.
  await fs.writeFile(DIRETTORE_GRID, buildDirettoreManifest(plan.spec), 'utf8');

  // A season launching on the global config gets its own copy filed away, so the
  // data folder always records what each season was driven with.
  await pinSeasonAssists(plan.championshipName, plan.seasonFolder, plan.assists);
  if (plan.trafficConfig) {
    await pinSeasonTraffic(plan.championshipName, plan.seasonFolder, plan.trafficConfig);
  }

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
    group: plan.group,
    aiSeat: plan.aiSeat,
    recorded: plan.record,
    aiLine: aiLine?.variant,
    trafficCars: plan.traffic?.cars,
    trafficFleet: plan.trafficFleet?.fleet,
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
