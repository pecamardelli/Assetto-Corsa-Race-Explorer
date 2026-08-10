'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type LaunchMode = 'weekend' | 'freerun';

const MODES: LaunchMode[] = ['weekend', 'freerun'];

type LaunchStatus = 'running' | 'completed' | 'failed';

interface LaunchState {
  id: string;
  status: LaunchStatus;
  mode: LaunchMode;
  roundNumber: number;
  trackLabel: string;
  error?: string;
  ingested?: string[];
}

interface LauncherContextValue {
  launch: LaunchState | null;
  error: string | null;
  pending: boolean;
  start: (round: number, mode: LaunchMode) => void;
  dismiss: () => void;
}

const LauncherContext = createContext<LauncherContextValue | null>(null);

const POLL_INTERVAL_MS = 3000;

const MODE_LABELS: Record<LaunchMode, string> = {
  weekend: 'Race weekend',
  freerun: 'Free run',
};

/**
 * Owns the one-at-a-time launch state for a season page. Kept above the round list
 * so a single poller serves every round's buttons.
 */
export function LaunchProvider({
  champId,
  seasonId,
  children,
}: {
  champId: string;
  seasonId: string;
  children: ReactNode;
}) {
  const [launch, setLaunch] = useState<LaunchState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  // Tracked in a ref so the poller can spot the running -> finished edge without
  // re-subscribing every time the state object changes.
  const wasRunning = useRef(false);

  const applyLaunch = useCallback(
    (next: LaunchState | null) => {
      setLaunch(next);

      if (wasRunning.current && next?.status !== 'running') {
        // Results have just been filed away — pull the new sessions into the page.
        router.refresh();
      }

      wasRunning.current = next?.status === 'running';
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch('/api/launch');
        if (!response.ok) return;

        const body = (await response.json()) as { launch: LaunchState | null };
        if (!cancelled) applyLaunch(body.launch);
      } catch {
        // A dropped poll is harmless; the next one will catch up.
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [applyLaunch]);

  const start = useCallback(
    async (round: number, mode: LaunchMode) => {
      setError(null);
      setPending(true);

      try {
        const response = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champId, seasonId, round, mode }),
        });

        const body = (await response.json()) as { launch?: LaunchState; error?: string };

        if (!response.ok) {
          setError(body.error ?? 'Failed to launch Assetto Corsa');
          return;
        }

        if (body.launch) applyLaunch(body.launch);
      } catch {
        setError('Could not reach the launch service');
      } finally {
        setPending(false);
      }
    },
    [applyLaunch, champId, seasonId]
  );

  const dismiss = useCallback(() => {
    setError(null);
    if (launch && launch.status !== 'running') setLaunch(null);
  }, [launch]);

  return (
    <LauncherContext.Provider
      value={{
        launch,
        error,
        pending,
        start: (round, mode) => void start(round, mode),
        dismiss,
      }}
    >
      {children}
    </LauncherContext.Provider>
  );
}

function useLauncher(): LauncherContextValue {
  const context = useContext(LauncherContext);
  if (!context) throw new Error('useLauncher must be used inside a LaunchProvider');
  return context;
}

/** Banner reporting whatever the launcher is doing, or how the last session went. */
export function LaunchStatusBanner() {
  const { launch, error, dismiss } = useLauncher();

  if (error) {
    return (
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <span>{error}</span>
        <button onClick={dismiss} className="text-red-400/70 hover:text-red-300">
          Dismiss
        </button>
      </div>
    );
  }

  if (!launch) return null;

  if (launch.status === 'running') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
        <span>
          {MODE_LABELS[launch.mode]} running at {launch.trackLabel} — R{launch.roundNumber}. Results
          are filed automatically when Assetto Corsa closes.
        </span>
      </div>
    );
  }

  if (launch.status === 'failed') {
    return (
      <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        <span>{launch.error ?? 'The session ended with an error.'}</span>
        <button onClick={dismiss} className="text-red-400/70 hover:text-red-300">
          Dismiss
        </button>
      </div>
    );
  }

  const filed = launch.ingested?.length ?? 0;

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border border-zinc-600 bg-zinc-700/30 px-4 py-3 text-sm text-zinc-300">
      <span>
        {MODE_LABELS[launch.mode]} at {launch.trackLabel} finished —{' '}
        {filed > 0
          ? `${filed} result file${filed === 1 ? '' : 's'} added to this season.`
          : 'no new result files were found.'}
      </span>
      <button onClick={dismiss} className="text-zinc-400 hover:text-zinc-200">
        Dismiss
      </button>
    </div>
  );
}

const BUTTON_STYLES: Record<LaunchMode, string> = {
  weekend: 'bg-red-500/20 hover:bg-red-500/30 text-red-400',
  freerun: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400',
};

const ICONS: Record<LaunchMode, ReactNode> = {
  weekend: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
  ),
  freerun: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  ),
};

const BUTTON_LABELS: Record<LaunchMode, string> = {
  weekend: 'Start Race',
  freerun: 'Free Run',
};

const BUTTON_HINTS: Record<LaunchMode, string> = {
  weekend: 'Launch qualifying then the race — the grid comes out of qualifying',
  freerun: 'Launch an untimed solo run at this track',
};

/** The launch buttons for one round. */
export default function RoundLaunchButtons({
  round,
  raceCompleted = false,
}: {
  round: number;
  /** Drops the weekend button once the round has a race on the books. */
  raceCompleted?: boolean;
}) {
  const { launch, pending, start } = useLauncher();
  const busy = pending || launch?.status === 'running';
  const modes = raceCompleted ? MODES.filter(mode => mode !== 'weekend') : MODES;

  return (
    // shrink-0 so the buttons keep their size and the track name gives way instead.
    <div className="flex shrink-0 flex-wrap gap-2">
      {modes.map(mode => (
        <button
          key={mode}
          onClick={() => start(round, mode)}
          disabled={busy}
          title={busy ? 'A session is already running' : BUTTON_HINTS[mode]}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_STYLES[mode]}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {ICONS[mode]}
          </svg>
          {BUTTON_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
