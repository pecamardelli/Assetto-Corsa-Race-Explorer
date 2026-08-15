'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  EARLIEST_TIME,
  GRIP_PRESETS,
  JUMP_START_PENALTIES,
  LATEST_TIME,
  MAX_AMBIENT_TEMP,
  MAX_ROAD_TEMP,
  MAX_WIND_SPEED,
  RANDOM_GRIP,
  RANDOM_WEATHER,
  RANDOM_WIND_DIRECTION,
  RaceSpec,
  RaceSpecSource,
  formatTimeOfDay,
  weatherLabel,
} from '../types/race-spec';
import { Group, NumberInput, Select, Slider, Toggle } from './SettingControls';
import { MENU_ITEM_CLASS, MenuItemIcon } from './MenuItem';

/**
 * Editor for one round's race settings, opened from its card's menu on the season
 * page. Saving writes an override for that round alone; "Use championship settings"
 * drops it again, and the round follows the .champ file as before.
 */

/** The sliders icon the round menu carries this entry under. */
const ICON_SETUP =
  'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4';

interface Loaded {
  spec: RaceSpec;
  championship: RaceSpec;
  source: RaceSpecSource;
  weathers: string[];
}

const minutes = (value: number) => (value === 0 ? 'Unlimited' : `${value} min`);
const celsius = (value: number) => `${value}°C`;
const kmh = (value: number) => `${value} km/h`;
const heading = (value: number) =>
  value === RANDOM_WIND_DIRECTION ? 'Random' : `${value}°`;

/**
 * A setting that can either sit on one value or be drawn from a range each time
 * the round is launched. The two are the same pair of numbers underneath: a range
 * whose ends meet is a fixed value, so "Vary" simply opens a gap between them.
 */
function VariableRange({
  label,
  hint,
  from,
  to,
  onChange,
  min,
  max,
  step,
  /** How wide a gap "Vary" opens when there is room for it. */
  spread,
  format,
}: {
  label: string;
  hint?: string;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  min: number;
  max: number;
  step: number;
  spread: number;
  format: (value: number) => string;
}) {
  const varies = to > from;

  const toggle = () => {
    if (varies) {
      onChange(from, from);
      return;
    }

    // Open the gap upwards, or downwards for a value already at the ceiling.
    if (from + spread <= max) onChange(from, from + spread);
    else onChange(Math.max(min, max - spread), max);
  };

  return (
    <div className="py-2" title={hint}>
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {varies ? `${format(from)} – ${format(to)}` : format(from)}
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={varies}
            title={
              varies
                ? 'Use one fixed value'
                : 'Draw a value from a range on every launch of this round'
            }
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-colors ${
              varies
                ? 'bg-cyan-500/30 text-cyan-300'
                : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300'
            }`}
          >
            Vary
          </button>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={from}
        aria-label={varies ? `${label}, lowest` : label}
        onChange={event => {
          const next = Number(event.target.value);
          onChange(next, Math.max(next, to));
        }}
        className="w-full accent-green-500"
      />
      {varies && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={to}
          aria-label={`${label}, highest`}
          onChange={event => {
            const next = Number(event.target.value);
            onChange(Math.min(next, from), next);
          }}
          className="w-full accent-cyan-500"
        />
      )}
    </div>
  );
}

/** -1 lets a lap stand however far off track it went. */
const TYRES_OUT_OPTIONS = [
  { value: -1, label: 'Never invalidate' },
  { value: 0, label: 'All four wheels out' },
  { value: 1, label: '1 wheel out' },
  { value: 2, label: '2 wheels out' },
  { value: 3, label: '3 wheels out' },
  { value: 4, label: '4 wheels out' },
];

export default function RaceSpecEditor({
  champId,
  seasonId,
  round,
  trackName,
  onOpen,
}: {
  /** Championship folder, as it is named under app/data. */
  champId: string;
  /** Season folder, e.g. "season_01". */
  seasonId: string;
  round: number;
  trackName: string;
  /** Told when the entry is picked, so the menu around it can step aside. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [spec, setSpec] = useState<RaceSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const query = `champ=${encodeURIComponent(champId)}&season=${encodeURIComponent(
    seasonId
  )}&round=${round}`;

  const apply = useCallback((body: Loaded) => {
    setLoaded(body);
    setSpec(body.spec);
  }, []);

  const request = useCallback(
    async (init: RequestInit, url = `/api/race-spec?${query}`) => {
      setBusy(true);
      setError(null);

      try {
        const response = await fetch(url, init);
        const body = (await response.json()) as Loaded & { error?: string };

        if (!response.ok) {
          setError(body.error ?? response.statusText);
          return false;
        }

        apply(body);
        return true;
      } catch {
        setError('Could not reach the server');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [apply, query]
  );

  const onClose = useCallback(() => setOpen(false), []);

  // Read the settings fresh on every open, so a round edited elsewhere — or raced
  // since the page was rendered — is never shown stale.
  const openEditor = () => {
    setOpen(true);
    onOpen?.();
    void request({ method: 'GET' });
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const set = <K extends keyof RaceSpec>(key: K, value: RaceSpec[K]) => {
    setSpec(current => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!spec) return;

    const saved = await request({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ champ: champId, season: seasonId, round, spec }),
    });

    if (saved) {
      router.refresh();
      onClose();
    }
  };

  const reset = async () => {
    if (await request({ method: 'DELETE' })) router.refresh();
  };

  // The dialog goes straight to the body: the entry that opens it sits inside a
  // menu that hides itself on the way, and a modal has no business being clipped
  // or laid out by the row it was launched from.
  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-700 p-6">
          <div>
            <span className="rounded bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-400">
              R{round}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white">{trackName}</h2>
            <p className="text-sm text-zinc-400">
              Race settings for this round&apos;s launches.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-6">
          {!spec || !loaded ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              {error ?? 'Loading…'}
            </p>
          ) : (
            <>
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  loaded.source === 'round'
                    ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    : 'border-zinc-600 bg-zinc-800/50 text-zinc-400'
                }`}
              >
                {loaded.source === 'round'
                  ? 'This round has its own settings. The championship file is untouched.'
                  : 'This round follows the championship file. Saving gives it its own settings.'}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Group title="Distance">
                  <Toggle
                    label="Point to point"
                    hint="A course with its finish somewhere else — no qualifying is run, and the field lines up in championship order"
                    value={spec.pointToPoint}
                    onChange={value => set('pointToPoint', value)}
                  />
                  <NumberInput
                    label="Race laps"
                    hint="Ignored by a free run, which never reaches the race"
                    value={spec.laps}
                    onChange={value => set('laps', value)}
                    min={1}
                    max={500}
                    suffix="laps"
                  />
                  <Slider
                    label="Qualifying"
                    hint={
                      spec.pointToPoint
                        ? 'Not used: a point-to-point round goes straight to its race'
                        : undefined
                    }
                    value={spec.qualifyingMinutes}
                    onChange={value => set('qualifyingMinutes', value)}
                    min={1}
                    max={120}
                    step={1}
                    format={minutes}
                  />
                  <Slider
                    label="Free run"
                    hint="0 leaves it untimed"
                    value={spec.practiceMinutes}
                    onChange={value => set('practiceMinutes', value)}
                    max={120}
                    step={5}
                    format={minutes}
                  />
                </Group>

                <Group title="Conditions">
                  <Select
                    label="Weather"
                    hint="Random draws again on every launch of this round"
                    value={spec.weather}
                    onChange={value => set('weather', value)}
                    options={[
                      { value: RANDOM_WEATHER, label: 'Random' },
                      ...loaded.weathers.map(folder => ({
                        value: folder,
                        label: weatherLabel(folder),
                      })),
                    ]}
                  />
                  <Select
                    label="Track grip"
                    hint="How much rubber is already down — random draws again on every launch"
                    value={spec.grip}
                    onChange={value => set('grip', value)}
                    options={[
                      { value: RANDOM_GRIP, label: 'Random' },
                      ...GRIP_PRESETS.map((preset, index) => ({
                        value: index,
                        label: preset.name,
                      })),
                    ]}
                  />
                  <VariableRange
                    label="Time of day"
                    hint="AC's sun only travels between 8:00 and 18:00"
                    from={spec.timeOfDayFrom}
                    to={spec.timeOfDayTo}
                    onChange={(from, to) => {
                      set('timeOfDayFrom', from);
                      set('timeOfDayTo', to);
                    }}
                    min={EARLIEST_TIME}
                    max={LATEST_TIME}
                    step={10}
                    spread={2 * 60}
                    format={formatTimeOfDay}
                  />
                  <VariableRange
                    label="Air temperature"
                    from={spec.ambientTempFrom}
                    to={spec.ambientTempTo}
                    onChange={(from, to) => {
                      set('ambientTempFrom', from);
                      set('ambientTempTo', to);
                    }}
                    min={0}
                    max={MAX_AMBIENT_TEMP}
                    step={1}
                    spread={8}
                    format={celsius}
                  />
                  <VariableRange
                    label="Road temperature"
                    from={spec.roadTempFrom}
                    to={spec.roadTempTo}
                    onChange={(from, to) => {
                      set('roadTempFrom', from);
                      set('roadTempTo', to);
                    }}
                    min={0}
                    max={MAX_ROAD_TEMP}
                    step={1}
                    spread={12}
                    format={celsius}
                  />
                </Group>

                <Group title="Wind">
                  <Slider
                    label="Minimum speed"
                    value={spec.windSpeedMin}
                    onChange={value => {
                      set('windSpeedMin', value);
                      // AC would draw from an inverted range if the max fell below.
                      if (value > spec.windSpeedMax) set('windSpeedMax', value);
                    }}
                    max={MAX_WIND_SPEED}
                    step={1}
                    format={kmh}
                  />
                  <Slider
                    label="Maximum speed"
                    value={spec.windSpeedMax}
                    onChange={value => {
                      set('windSpeedMax', value);
                      if (value < spec.windSpeedMin) set('windSpeedMin', value);
                    }}
                    max={MAX_WIND_SPEED}
                    step={1}
                    format={kmh}
                  />
                  <Slider
                    label="Direction"
                    hint="Compass heading the wind blows from — all the way down is random"
                    value={spec.windDirection}
                    onChange={value => set('windDirection', value)}
                    min={RANDOM_WIND_DIRECTION}
                    max={359}
                    step={5}
                    format={heading}
                  />
                </Group>

                <Group title="Rules">
                  <Toggle
                    label="Penalties"
                    hint="Cutting the track and speeding in the pits are punished"
                    value={spec.penalties}
                    onChange={value => set('penalties', value)}
                  />
                  <Select
                    label="Jump start"
                    value={spec.jumpStartPenalty}
                    onChange={value => set('jumpStartPenalty', value)}
                    options={JUMP_START_PENALTIES.map((label, index) => ({
                      value: index,
                      label,
                    }))}
                  />
                  <Select
                    label="Lap invalidation"
                    hint="How far off track a lap survives"
                    value={spec.tyresOut}
                    onChange={value => set('tyresOut', value)}
                    options={TYRES_OUT_OPTIONS}
                  />
                </Group>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="rounded-lg bg-green-500/20 px-6 py-2 text-sm font-semibold text-green-400 transition-all hover:bg-green-500/30 hover:shadow-lg hover:shadow-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-700"
                >
                  Cancel
                </button>

                {loaded.source === 'round' && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    title="Drop this round's settings and follow the championship file again"
                    className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Use championship settings
                  </button>
                )}

                {error && <span className="text-sm text-red-400">{error}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={openEditor}
        title="Edit this round's race settings"
        className={MENU_ITEM_CLASS}
      >
        <MenuItemIcon path={ICON_SETUP} tone="text-cyan-400" />
        Race Setup
      </button>

      {open && createPortal(dialog, document.body)}
    </>
  );
}
