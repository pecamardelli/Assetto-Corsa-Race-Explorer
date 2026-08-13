'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import RaceSpecEditor from './RaceSpecEditor';
import { MENU_ITEM_CLASS, MenuItemIcon } from './MenuItem';
import { useLauncher, type LaunchMode } from './RaceLauncher';

/**
 * Everything a round card can do, behind one button. The launch entries only
 * appear for a browser on the machine that runs the game — see the launcher's
 * `isLocal` — so a season read from another room shows settings alone.
 */

interface LaunchEntry {
  key: string;
  label: string;
  hint: string;
  /** Path data for the entry's 24x24 stroked icon. */
  icon: string;
  tone: string;
  mode: LaunchMode;
  /** Whether the sessions this entry runs belong in the season. */
  record: boolean;
}

const ICON_RACE = 'M5 3l14 9-14 9V3z';
const ICON_FREE_RUN = 'M13 10V3L4 14h7v7l9-11h-7z';
const ICON_RERUN =
  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';

/** Roughly how tall the menu gets, for deciding which way it should open. */
const MENU_HEIGHT_PX = 160;

export default function RoundMenu({
  specChampId,
  specSeasonId,
  round,
  trackName,
  raceCompleted = false,
}: {
  /** Championship folder, as it is named under app/data. */
  specChampId: string;
  /** Season folder, e.g. "season_01". */
  specSeasonId: string;
  round: number;
  trackName: string;
  /** A round with a finished race behind it is only ever re-run, never recorded. */
  raceCompleted?: boolean;
}) {
  const { launch, pending, isLocal, start } = useLauncher();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) close();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    // The menu is anchored to a button that scrolls, so it steps aside rather than
    // drifting away from it.
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  const toggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (open) {
      close();
      return;
    }

    // Opening downwards would run a bottom-of-the-page round's menu off the
    // screen, so those drop upwards instead.
    const rect = event.currentTarget.getBoundingClientRect();
    setDropUp(rect.bottom + MENU_HEIGHT_PX > window.innerHeight);
    setOpen(true);
  };

  const busy = pending || launch?.status === 'running';

  const launches: LaunchEntry[] = isLocal
    ? [
        raceCompleted
          ? {
              key: 'rerun',
              label: 'Race Again',
              hint: 'Run the weekend again for the fun of it — no result is recorded',
              icon: ICON_RERUN,
              tone: 'text-amber-400',
              mode: 'weekend',
              record: false,
            }
          : {
              key: 'weekend',
              label: 'Start Race',
              hint: 'Launch qualifying then the race — the grid comes out of qualifying',
              icon: ICON_RACE,
              tone: 'text-red-400',
              mode: 'weekend',
              record: true,
            },
        {
          key: 'freerun',
          label: 'Free Run',
          // Once the round is on the books nothing driven at it counts any more, so
          // a free run there stops filing practice sessions into the season too.
          hint: raceCompleted
            ? 'Launch an untimed solo run at this track — no session is recorded'
            : 'Launch an untimed solo run at this track',
          icon: ICON_FREE_RUN,
          tone: 'text-blue-400',
          mode: 'freerun',
          record: !raceCompleted,
        },
      ]
    : [];

  return (
    // shrink-0 so the button keeps its size and the track name gives way instead.
    <div className="relative shrink-0" ref={anchor}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for round ${round}`}
        title="Round actions"
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
          open
            ? 'bg-zinc-700 text-white'
            : 'bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700 hover:text-white'
        }`}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>

      {/* Kept mounted and merely hidden: the settings dialog lives in here, and
          picking it closes the menu on its way up. */}
      <div
        role="menu"
        aria-label={`Round ${round}`}
        className={`absolute right-0 z-40 w-60 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-2xl ${
          dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
        } ${open ? '' : 'hidden'}`}
      >
        <RaceSpecEditor
          champId={specChampId}
          seasonId={specSeasonId}
          round={round}
          trackName={trackName}
          onOpen={close}
        />

        {launches.map(entry => (
          <button
            key={entry.key}
            type="button"
            role="menuitem"
            disabled={busy}
            title={busy ? 'A session is already running' : entry.hint}
            onClick={() => {
              close();
              start(round, entry.mode, entry.record);
            }}
            className={MENU_ITEM_CLASS}
          >
            <MenuItemIcon path={entry.icon} tone={entry.tone} />
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
