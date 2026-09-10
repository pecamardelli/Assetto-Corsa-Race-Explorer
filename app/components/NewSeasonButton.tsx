'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Starting the next season, from the seasons page.
 *
 * The new season is the last one copied forward — same roster, same rules, same
 * calendar, no races — so the button says what it will copy rather than asking. What
 * it cannot say is whether copying is a good idea yet, so `lastSeasonRunning` puts the
 * unfinished season's name in a confirmation instead of disabling the button: a
 * championship is allowed more than one season in flight, and only Pablo knows whether
 * this one is.
 *
 * On success it goes straight to the new season, which is where the rounds get edited.
 */

interface Props {
  champId: string;
  /** The season being copied, e.g. `Season 02`, for the button's title. */
  lastSeasonName: string;
  /** Set when that season still has rounds left to race, which earns a confirmation. */
  lastSeasonRunning: { completed: number; rounds: number } | null;
}

interface Created {
  season: string;
  copiedFrom: string;
  files: string[];
}

export default function NewSeasonButton({ champId, lastSeasonName, lastSeasonRunning }: Props) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (lastSeasonRunning) {
      const { completed, rounds } = lastSeasonRunning;
      const go = window.confirm(
        `${lastSeasonName} has raced ${completed} of its ${rounds} rounds. ` +
          'Start the next season anyway?'
      );
      if (!go) return;
    }

    setWorking(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/championship/${encodeURIComponent(champId)}/season`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? response.statusText);
        return;
      }
      const created = (await response.json()) as Created;
      router.refresh();
      router.push(
        `/championship/${encodeURIComponent(champId)}/season/${created.season}`
      );
    } catch {
      setError('Could not reach the server');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={start}
        disabled={working}
        title={`Copies ${lastSeasonName} — its roster, rules and calendar, without its races`}
        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm font-semibold transition-all hover:shadow-lg hover:shadow-green-500/20 flex items-center gap-2 disabled:opacity-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {working ? 'Starting…' : 'New Season'}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}
