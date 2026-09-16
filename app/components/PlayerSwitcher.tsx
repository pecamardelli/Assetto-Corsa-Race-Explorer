'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Who is driving, in the header of every page.
 *
 * The one control in the app that changes what "you" means: the seat a launch takes
 * out of the roster, the car and the aids it goes out with, and the name the result
 * comes back under. Nothing else about a season changes — the standings go on being
 * one table, with each of us scoring the rounds we actually drove.
 *
 * A client component with its own fetch rather than a server-rendered name, so the
 * layout stays static and the rest of the app keeps its caching.
 */

interface Player {
  name: string;
  nation: string;
  portrait: string | null;
  primary: boolean;
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-zinc-300">
      {initials}
    </span>
  );
}

function Face({ player }: { player: Player }) {
  if (!player.portrait) return <Initials name={player.name} />;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={player.portrait}
      alt=""
      aria-hidden="true"
      className="h-8 w-8 rounded-full object-cover"
    />
  );
}

export default function PlayerSwitcher() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [active, setActive] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/api/player');
        if (!response.ok) return;

        const body = (await response.json()) as { active: string; players: Player[] };
        if (cancelled) return;
        setPlayers(body.players);
        setActive(body.active);
      } catch {
        // Without an answer the header simply shows nothing, which is better than an
        // error where a name should be.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = async (name: string) => {
    setOpen(false);
    if (name === active || busy) return;

    setBusy(true);
    try {
      const response = await fetch('/api/player', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) return;

      const body = (await response.json()) as { active: string; players: Player[] };
      setPlayers(body.players);
      setActive(body.active);
      // Seasons, car pages and round menus are all rendered against whoever was
      // driving, so the page in front of us has to be built again.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // One player is not a choice, and an install that has never named one has nothing
  // to show.
  if (players.length === 0) return null;

  const current = players.find(player => player.name === active) ?? players[0];

  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        disabled={busy || players.length < 2}
        className="flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-800/80 py-1.5 pl-1.5 pr-4 text-left transition-colors hover:border-zinc-500 hover:bg-zinc-700/70 disabled:cursor-default disabled:opacity-80"
        title={players.length < 2 ? 'The only driver on this install' : 'Change driver'}
      >
        <Face player={current} />
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Driving
          </span>
          <span className="text-sm font-semibold text-white">{current.name}</span>
        </span>
        {players.length > 1 && (
          <svg
            className={`h-4 w-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {players.map(player => (
            <button
              key={player.name}
              type="button"
              onClick={() => void choose(player.name)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                player.name === active
                  ? 'bg-green-500/15 text-green-300'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Face player={player} />
              <span className="flex-1 text-sm font-semibold">{player.name}</span>
              {player.name === active && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
          <p className="border-t border-zinc-800 px-3 py-2 text-[11px] leading-snug text-zinc-500">
            Whoever is driving takes the seat, their own car and their own aids, and
            scores under their own name.
          </p>
        </div>
      )}
    </div>
  );
}
