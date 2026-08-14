'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

export type LaunchMode = 'weekend' | 'race' | 'freerun';

type LaunchStatus = 'running' | 'completed' | 'failed';

/** Only the fields the round menus need; /api/launch reports more than this. */
interface LaunchState {
  id: string;
  status: LaunchStatus;
  mode: LaunchMode;
  roundNumber: number;
}

/** One batch of a round too big to race at its track in a single go. */
export interface LaunchGroup {
  label: string;
  drivers: string[];
}

export interface LauncherContextValue {
  launch: LaunchState | null;
  pending: boolean;
  /** Whether this browser is sitting on the machine that runs the game. */
  isLocal: boolean;
  /** `record: false` runs the session for its own sake and files nothing away. */
  start: (
    round: number,
    mode: LaunchMode,
    record?: boolean,
    /** Omitted for a round that fits its track and so races whole. */
    group?: LaunchGroup
  ) => void;
}

const LauncherContext = createContext<LauncherContextValue | null>(null);

const POLL_INTERVAL_MS = 3000;

/**
 * Launching starts an executable on the machine serving the page, so the controls
 * are only any use to a browser on that same machine — /api/launch turns everyone
 * else away. Read through useSyncExternalStore because the same markup is served to
 * local and remote viewers alike: the server has no answer, so it says no, and the
 * client settles it after hydration without tripping over its own HTML.
 */
const subscribeToNothing = () => () => {};

function servedLocally(): boolean {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function servedRemotely(): boolean {
  return false;
}

function useIsLocal(): boolean {
  return useSyncExternalStore(subscribeToNothing, servedLocally, servedRemotely);
}

/**
 * Owns the one-at-a-time launch state for a season page. Kept above the round list
 * so a single poller serves every round's menu.
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
  const [pending, setPending] = useState(false);
  const isLocal = useIsLocal();
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
    // Nothing can be launched from a remote browser, so spare it the polling.
    if (!isLocal) return;

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
  }, [applyLaunch, isLocal]);

  const start = useCallback(
    async (round: number, mode: LaunchMode, record: boolean, group?: LaunchGroup) => {
      setPending(true);

      try {
        const response = await fetch('/api/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ champId, seasonId, round, mode, record, group }),
        });

        const body = (await response.json()) as { launch?: LaunchState; error?: string };

        if (!response.ok) {
          // Nothing on the page reports this, so leave a trace in the console.
          console.error('Launch refused:', body.error ?? response.statusText);
          return;
        }

        if (body.launch) applyLaunch(body.launch);
      } catch (cause) {
        console.error('Could not reach the launch service:', cause);
      } finally {
        setPending(false);
      }
    },
    [applyLaunch, champId, seasonId]
  );

  return (
    <LauncherContext.Provider
      value={{
        launch,
        pending,
        isLocal,
        start: (round, mode, record = true, group) =>
          void start(round, mode, record, group),
      }}
    >
      {children}
    </LauncherContext.Provider>
  );
}

export function useLauncher(): LauncherContextValue {
  const context = useContext(LauncherContext);
  if (!context) throw new Error('useLauncher must be used inside a LaunchProvider');
  return context;
}
