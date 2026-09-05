'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The season's lineup: a modal listing every roster entry with a checkbox, opened from
 * the season's presets page. Unchecked drivers stay home on every launch of the
 * season until checked again. The player's own entry is always in and cannot be
 * unchecked -- AC gives CAR_0 to whoever is at the keyboard.
 */

export interface LineupEntry {
  name: string;
  /** Display name of the car, from the car data; the folder id when unknown. */
  car: string;
  nation: string;
  /** A roster car that shares the road without contesting the championship. */
  traffic: boolean;
  /** The entry the player drives; always fielded. */
  player: boolean;
}

interface Scope {
  champId: string;
  seasonId: string;
}

export default function LineupPicker({
  roster,
  initialExcluded,
  scope,
}: {
  roster: LineupEntry[];
  initialExcluded: string[];
  scope: Scope;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set(initialExcluded));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const racers = roster.filter(entry => !entry.traffic);
  const traffic = roster.filter(entry => entry.traffic);
  const fielded = roster.filter(entry => entry.player || !excluded.has(entry.name));
  const aiRacing = fielded.filter(entry => !entry.traffic && !entry.player).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = (entry: LineupEntry) => {
    if (entry.player) return;
    setExcluded(current => {
      const next = new Set(current);
      if (next.has(entry.name)) next.delete(entry.name);
      else next.add(entry.name);
      return next;
    });
  };

  const setAll = (entries: LineupEntry[], fielded: boolean) => {
    setExcluded(current => {
      const next = new Set(current);
      for (const entry of entries) {
        if (entry.player) continue;
        if (fielded) next.delete(entry.name);
        else next.add(entry.name);
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champ: scope.champId,
          season: scope.seasonId,
          excluded: Array.from(excluded),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? response.statusText);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setExcluded(new Set(initialExcluded));
    setError(null);
    setOpen(false);
  };

  const row = (entry: LineupEntry) => {
    const on = entry.player || !excluded.has(entry.name);
    return (
      <label
        key={entry.name}
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
          on ? 'bg-zinc-800/80 hover:bg-zinc-800' : 'bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50'
        } ${entry.player ? 'cursor-default' : ''}`}
      >
        <input
          type="checkbox"
          checked={on}
          disabled={entry.player}
          onChange={() => toggle(entry)}
          className="h-4 w-4 accent-green-500"
        />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-semibold ${on ? 'text-white' : 'text-zinc-400'}`}>
            {entry.name}
            {entry.player && (
              <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-400">
                you
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-zinc-400">{entry.car}</span>
        </span>
        <span className="text-xs uppercase tracking-wide text-zinc-500">{entry.nation}</span>
      </label>
    );
  };

  const section = (title: string, entries: LineupEntry[]) =>
    entries.length > 0 && (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {title} ({entries.filter(entry => entry.player || !excluded.has(entry.name)).length} of{' '}
            {entries.length})
          </h3>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAll(entries, true)}
              className="text-zinc-400 hover:text-white"
            >
              All
            </button>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={() => setAll(entries, false)}
              className="text-zinc-400 hover:text-white"
            >
              None
            </button>
          </div>
        </div>
        <div className="grid gap-1 sm:grid-cols-2">{entries.map(row)}</div>
      </div>
    );

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={event => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div className="w-full max-w-3xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-700 p-6">
          <div>
            <span className="rounded bg-green-500/20 px-2 py-1 text-xs font-bold uppercase text-green-400">
              Lineup
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white">Who goes out this season</h2>
            <p className="text-sm text-zinc-400">
              Unchecked drivers stay home on every launch of the season. {aiRacing} AI driver
              {aiRacing === 1 ? '' : 's'} race{aiRacing === 1 ? 's' : ''} against you.
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {section('Drivers', racers)}
          {section('Roster traffic', traffic)}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-700 p-6">
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-green-500/80 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save lineup'}
          </button>
        </div>
      </div>
    </div>
  );

  const total = roster.filter(entry => !entry.traffic && !entry.player).length;
  const outTraffic = traffic.filter(entry => excluded.has(entry.name)).length;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Lineup</h2>
          <p className="text-sm text-zinc-400">
            {aiRacing} of {total} AI driver{total === 1 ? '' : 's'} race against you
            {traffic.length > 0 &&
              `, ${traffic.length - outTraffic} of ${traffic.length} roster traffic car${
                traffic.length === 1 ? '' : 's'
              } on the road`}
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-700"
        >
          Choose drivers…
        </button>
      </div>
      {open && createPortal(dialog, document.body)}
    </div>
  );
}
