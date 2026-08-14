'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import RaceSpecEditor from './RaceSpecEditor';
import { MENU_ITEM_CLASS, MenuItemIcon } from './MenuItem';
import { useLauncher, type LaunchGroup, type LaunchMode } from './RaceLauncher';

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
  /** Set on the entries of a round being raced a class at a time. */
  group?: LaunchGroup;
}

/** What /api/groups says about fitting this round's field onto its track. */
interface RoundGroups {
  capacity: number | null;
  entries: number;
  splitRequired: boolean;
  groups: LaunchGroup[];
}

const ICON_RACE = 'M5 3l14 9-14 9V3z';
const ICON_RACE_ONLY = 'M13 5l7 7-7 7M5 5l7 7-7 7';
const ICON_FREE_RUN = 'M13 10V3L4 14h7v7l9-11h-7z';
const ICON_RERUN =
  'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15';
const ICON_GROUP = 'M17 20h5v-2a3 3 0 00-5.36-1.9M17 20H7m10 0v-2c0-.66-.13-1.3-.36-1.9m0 0a5 5 0 00-9.28 0M7 20H2v-2a3 3 0 015.36-1.9M7 20v-2c0-.66.13-1.3.36-1.9m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z';

/** Roughly how tall the menu gets, for deciding which way it should open. */
const MENU_HEIGHT_PX = 200;

/** Added to that for each extra row a round split into classes contributes. */
const MENU_ROW_PX = 36;

export default function RoundMenu({
  specChampId,
  specSeasonId,
  round,
  trackName,
  raceCompleted = false,
  qualifyingRecorded = false,
}: {
  /** Championship folder, as it is named under app/data. */
  specChampId: string;
  /** Season folder, e.g. "season_01". */
  specSeasonId: string;
  round: number;
  trackName: string;
  /** A round with a finished race behind it is only ever re-run, never recorded. */
  raceCompleted?: boolean;
  /** Whether a qualifying for this round is already filed, so a race can grid off it. */
  qualifyingRecorded?: boolean;
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
    // screen, so those drop upwards instead. A round raced in classes carries a row
    // per class, so its menu is taller than the usual three entries.
    const extraRows = Math.max((groups?.groups.length ?? 1) - 1, 0);
    const height = MENU_HEIGHT_PX + extraRows * MENU_ROW_PX;

    const rect = event.currentTarget.getBoundingClientRect();
    setDropUp(rect.bottom + height > window.innerHeight);
    setOpen(true);
  };

  const busy = pending || launch?.status === 'running';

  // Whether this round's field fits its track, which decides whether the menu offers
  // one race or one per class. Asked for when the menu is first opened rather than on
  // render, so a season page does not fire a request per round on the way in.
  const [groups, setGroups] = useState<RoundGroups | null>(null);

  useEffect(() => {
    if (!open || !isLocal || groups) return;

    let cancelled = false;

    void (async () => {
      try {
        const query = new URLSearchParams({
          champId: specChampId,
          seasonId: specSeasonId,
          round: String(round),
        });
        const response = await fetch(`/api/groups?${query}`);
        if (!response.ok) return;

        const body = (await response.json()) as RoundGroups;
        if (!cancelled) setGroups(body);
      } catch {
        // The menu simply keeps offering the whole-field race, which is what a
        // round that fits would have offered anyway.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, isLocal, groups, specChampId, specSeasonId, round]);

  const split = groups?.splitRequired && groups.groups.length > 0 ? groups.groups : null;

  const launches: LaunchEntry[] = isLocal
    ? [
        // With qualifying already on the books there is nothing left to run but the
        // race itself, and its grid is rebuilt from that result rather than driven
        // for a second time. A round going out in classes qualifies each of them as
        // it goes, so the shortcut is not offered there.
        ...(qualifyingRecorded && !raceCompleted && !split
          ? [
              {
                key: 'race',
                label: 'Race Only',
                hint: 'Skip straight to the race — the grid comes from the qualifying already run here',
                icon: ICON_RACE_ONLY,
                tone: 'text-green-400',
                mode: 'race' as const,
                record: true,
              },
            ]
          : []),
        // A field too big for the track goes out a class at a time, each batch its
        // own session. The standings put them back together into one result.
        ...(split
          ? split.map((group, index) => ({
              key: `group-${index}`,
              label: group.label,
              hint: raceCompleted
                ? `Run this class again for the fun of it (${group.drivers.length} cars) — no result is recorded`
                : `Qualify and race the ${group.label} class (${group.drivers.length} cars) — the round is classified once every class has run`,
              icon: ICON_GROUP,
              tone: raceCompleted ? 'text-amber-400' : 'text-red-400',
              mode: 'weekend' as const,
              record: !raceCompleted,
              group,
            }))
          : [
              raceCompleted
                ? {
                    key: 'rerun',
                    label: 'Race Again',
                    hint: 'Run the weekend again for the fun of it — no result is recorded',
                    icon: ICON_RERUN,
                    tone: 'text-amber-400',
                    mode: 'weekend' as const,
                    record: false,
                  }
                : {
                    key: 'weekend',
                    label: 'Start Race',
                    hint: 'Launch qualifying then the race — the grid comes out of qualifying',
                    icon: ICON_RACE,
                    tone: 'text-red-400',
                    mode: 'weekend' as const,
                    record: true,
                  },
            ]),
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
              start(round, entry.mode, entry.record, entry.group);
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
