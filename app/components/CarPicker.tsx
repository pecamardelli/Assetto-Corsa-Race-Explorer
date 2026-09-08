'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CAR_KIND_LABELS,
  DRIVETRAIN_LABELS,
  type CarKind,
  type Drivetrain,
  type InstalledCar,
  type InstalledSkin,
  decadeOf,
  powerToWeight,
} from '../types/installed-car';
import type { PlayerCarConfig } from '../types/player-car';

/**
 * Choosing the car a road season is driven in, out of everything the game has installed.
 *
 * Three hundred and fifty cars is too many to read down, so the list is something to
 * narrow rather than something to browse: a search box over the name, the brand and the
 * folder, and five facets beside it that between them answer "a fast rear-drive road car
 * from the eighties" in four clicks. The facets are built from the cars themselves — the
 * brand list is the brands that are installed, the decades are the decades there are
 * cars in — so nothing offers a filter that would come back empty.
 *
 * Picking a card opens the car rather than choosing it. A preview at the top of a grid
 * is one livery of one angle; the specs, the description and the other liveries are what
 * you actually choose on, and they need the room. So the card selects, the panel decides,
 * and nothing is saved until the button in the panel is pressed.
 */

interface Scope {
  champId: string;
  seasonId: string;
}

/** The car the season's .champ entered the player in, which a pick overrides. */
export interface ChampCar {
  id: string;
  name: string;
  skin: string;
}

type SortKey = 'brand' | 'name' | 'year' | 'power' | 'weight' | 'ratio' | 'topspeed';

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Name' },
  { key: 'year', label: 'Newest' },
  { key: 'power', label: 'Most power' },
  { key: 'ratio', label: 'Power to weight' },
  { key: 'weight', label: 'Lightest' },
  { key: 'topspeed', label: 'Top speed' },
];

const ANY = '';

/** The picture routes. Both are served out of the install; see /api/cars/image. */
function previewUrl(car: string, skin: string, thumb = false): string {
  const params = new URLSearchParams({ car });
  if (skin) params.set('skin', skin);
  if (thumb) params.set('size', 'thumb');
  return `/api/cars/image?${params}`;
}

function badgeUrl(car: string): string {
  return `/api/cars/image?${new URLSearchParams({ car, kind: 'badge' })}`;
}

/** "442bhp · 1490kg · 295km/h", skipping whatever the car does not state. */
function specLine(car: InstalledCar): string {
  return [car.specs.bhp, car.specs.weight, car.specs.topspeed].filter(Boolean).join(' · ');
}

function selectClass(): string {
  return (
    'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
    'transition-colors hover:border-zinc-500 focus:border-cyan-500 focus:outline-none'
  );
}

function labelClass(): string {
  return 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500';
}

export default function CarPicker({
  scope,
  cars,
  champCar,
  initialPick,
  playerName,
}: {
  scope: Scope;
  /** Every car the install has, brand-ordered. */
  cars: InstalledCar[];
  champCar: ChampCar;
  initialPick: PlayerCarConfig | null;
  playerName: string;
}) {
  const router = useRouter();
  const [pick, setPick] = useState<PlayerCarConfig | null>(initialPick);

  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState(ANY);
  const [kind, setKind] = useState<CarKind | ''>(ANY);
  const [drive, setDrive] = useState<Drivetrain | ''>(ANY);
  const [decade, setDecade] = useState(ANY);
  const [minBhp, setMinBhp] = useState(0);
  const [sort, setSort] = useState<SortKey>('brand');

  /** The car whose panel is open, which is not yet the car that has been chosen. */
  const [opened, setOpened] = useState<InstalledCar | null>(null);

  const driving = pick?.car ?? champCar.id;
  const drivingSkin = pick?.skin ?? champCar.skin;
  const current = cars.find(car => car.id === driving) ?? null;

  const brands = useMemo(
    () => Array.from(new Set(cars.map(car => car.brand))).sort((a, b) => a.localeCompare(b)),
    [cars]
  );

  const decades = useMemo(() => {
    const found = new Set<string>();
    for (const car of cars) {
      const era = decadeOf(car.year);
      if (era) found.add(era);
    }
    return Array.from(found).sort();
  }, [cars]);

  /** The most powerful car installed, which is where the power slider ends. */
  const maxBhp = useMemo(
    () => Math.ceil(Math.max(0, ...cars.map(car => car.bhp ?? 0)) / 50) * 50,
    [cars]
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();

    const matches = cars.filter(car => {
      if (brand && car.brand !== brand) return false;
      if (kind && car.kind !== kind) return false;
      if (drive && car.drivetrain !== drive) return false;
      if (decade && decadeOf(car.year) !== decade) return false;
      // A car that states no power is not a car with none, so it is only hidden once
      // the slider has actually been asked for something.
      if (minBhp > 0 && (car.bhp ?? 0) < minBhp) return false;
      if (!needle) return true;

      return (
        car.name.toLowerCase().includes(needle) ||
        car.brand.toLowerCase().includes(needle) ||
        car.id.toLowerCase().includes(needle) ||
        car.carClass.toLowerCase().includes(needle) ||
        car.tags.some(tag => tag.toLowerCase().includes(needle))
      );
    });

    // Every sort but the two alphabetical ones is "most first", and a car that states
    // nothing to sort on goes to the bottom rather than to the top of the biggest.
    const by = (value: number | null) => (value === null ? -Infinity : value);
    const sorted = [...matches];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'year':
          return by(b.year) - by(a.year) || a.name.localeCompare(b.name);
        case 'power':
          return by(b.bhp) - by(a.bhp) || a.name.localeCompare(b.name);
        case 'ratio':
          return by(powerToWeight(b)) - by(powerToWeight(a)) || a.name.localeCompare(b.name);
        case 'weight':
          return (a.weightKg ?? Infinity) - (b.weightKg ?? Infinity) || a.name.localeCompare(b.name);
        case 'topspeed':
          return by(b.topSpeedKmh) - by(a.topSpeedKmh) || a.name.localeCompare(b.name);
        default:
          return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [cars, search, brand, kind, drive, decade, minBhp, sort]);

  const filtered = Boolean(search || brand || kind || drive || decade || minBhp);

  const reset = () => {
    setSearch('');
    setBrand(ANY);
    setKind(ANY);
    setDrive(ANY);
    setDecade(ANY);
    setMinBhp(0);
  };

  return (
    <div className="space-y-6">
      <CurrentCar
        car={current}
        id={driving}
        skin={drivingSkin}
        overridden={pick !== null}
        champCar={champCar}
        playerName={playerName}
        scope={scope}
        onCleared={() => {
          setPick(null);
          router.refresh();
        }}
        onOpen={() => current && setOpened(current)}
      />

      {/* Filters. A row of selects rather than a rail down the side: the grid wants the
          whole width, and six facets fit across one line on anything but a phone. */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="sm:col-span-2 xl:col-span-2">
            <label className={labelClass()} htmlFor="car-search">
              Search
            </label>
            <input
              id="car-search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Name, brand, folder, tag…"
              className={selectClass()}
            />
          </div>

          <div>
            <label className={labelClass()} htmlFor="car-brand">
              Brand
            </label>
            <select
              id="car-brand"
              value={brand}
              onChange={event => setBrand(event.target.value)}
              className={selectClass()}
            >
              <option value={ANY}>Any brand</option>
              {brands.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()} htmlFor="car-kind">
              Type
            </label>
            <select
              id="car-kind"
              value={kind}
              onChange={event => setKind(event.target.value as CarKind | '')}
              className={selectClass()}
            >
              <option value={ANY}>Any type</option>
              {(Object.keys(CAR_KIND_LABELS) as CarKind[]).map(value => (
                <option key={value} value={value}>
                  {CAR_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()} htmlFor="car-drive">
              Drivetrain
            </label>
            <select
              id="car-drive"
              value={drive}
              onChange={event => setDrive(event.target.value as Drivetrain | '')}
              className={selectClass()}
            >
              <option value={ANY}>Any drivetrain</option>
              {(Object.keys(DRIVETRAIN_LABELS) as Drivetrain[]).map(value => (
                <option key={value} value={value}>
                  {DRIVETRAIN_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()} htmlFor="car-decade">
              Era
            </label>
            <select
              id="car-decade"
              value={decade}
              onChange={event => setDecade(event.target.value)}
              className={selectClass()}
            >
              <option value={ANY}>Any era</option>
              {decades.map(era => (
                <option key={era} value={era}>
                  {era}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()} htmlFor="car-sort">
              Sort by
            </label>
            <select
              id="car-sort"
              value={sort}
              onChange={event => setSort(event.target.value as SortKey)}
              className={selectClass()}
            >
              {SORTS.map(option => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex min-w-64 flex-1 items-center gap-3 text-sm text-zinc-400">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Min power
            </span>
            <input
              type="range"
              min={0}
              max={maxBhp}
              step={25}
              value={minBhp}
              onChange={event => setMinBhp(Number(event.target.value))}
              className="h-1 flex-1 accent-cyan-500"
            />
            <span className="w-20 whitespace-nowrap text-right font-mono text-xs text-zinc-300">
              {minBhp > 0 ? `${minBhp} bhp` : 'any'}
            </span>
          </label>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {shown.length} of {cars.length} cars
            </span>
            {filtered && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:bg-zinc-700"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {cars.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No Assetto Corsa install could be read from this machine, so there are no cars
          to offer. Set AC_ROOT to the install folder and reload.
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No installed car matches that.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {shown.map(car => (
            <CarCard
              key={car.id}
              car={car}
              driving={car.id === driving}
              onOpen={() => setOpened(car)}
            />
          ))}
        </div>
      )}

      {opened && (
        <CarPanel
          car={opened}
          scope={scope}
          driving={opened.id === driving}
          drivingSkin={opened.id === driving ? drivingSkin : ''}
          onClose={() => setOpened(null)}
          onSaved={saved => {
            setPick(saved);
            setOpened(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- the car in the seat */

/**
 * The preview of the car in the seat.
 *
 * The one picture on this page that can be missing: a .champ names its liveries by hand
 * and does not always match the folder's case, while everything else here names a livery
 * that was read off the disk. So a miss falls back to the car's own first livery, which
 * at least shows the right car, and a second miss leaves a hole rather than a
 * broken-image icon.
 */
function SeatPreview({ id, skin }: { id: string; skin: string }) {
  const [stage, setStage] = useState(0);

  if (stage > 1) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600 sm:w-56">
        No preview
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={previewUrl(id, stage === 0 ? skin : '')}
      alt=""
      onError={() => setStage(current => current + 1)}
      className="h-32 w-full rounded-lg border border-zinc-700 object-cover sm:w-56"
    />
  );
}

function CurrentCar({
  car,
  id,
  skin,
  overridden,
  champCar,
  playerName,
  scope,
  onCleared,
  onOpen,
}: {
  /** Null when the car in the .champ is not installed on this machine. */
  car: InstalledCar | null;
  id: string;
  skin: string;
  overridden: boolean;
  champCar: ChampCar;
  playerName: string;
  scope: Scope;
  onCleared: () => void;
  onOpen: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = async () => {
    setClearing(true);
    setError(null);
    try {
      const query = new URLSearchParams({ champ: scope.champId, season: scope.seasonId });
      const response = await fetch(`/api/player-car?${query}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? response.statusText);
        return;
      }
      onCleared();
    } catch {
      setError('Could not reach the server');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-700 bg-zinc-800/50 p-5 sm:flex-row sm:items-center">
      {/* Keyed on what it shows, so a change of car starts its fallbacks over. */}
      <SeatPreview key={`${id}/${skin}`} id={id} skin={skin} />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-400">
            {playerName} drives
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
              overridden
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-zinc-700/60 text-zinc-400'
            }`}
          >
            {overridden ? 'season pick' : 'from the .champ'}
          </span>
        </div>
        <h2 className="truncate text-2xl font-bold text-white">{car?.name ?? id}</h2>
        <p className="truncate text-sm text-zinc-400">
          {car ? (
            <>
              {car.brand}
              {car.year && <span className="text-zinc-500"> · {car.year}</span>}
              {specLine(car) && <span className="text-zinc-500"> · {specLine(car)}</span>}
            </>
          ) : (
            'This car is not installed on this machine.'
          )}
        </p>
        {skin && <p className="mt-1 truncate text-xs text-zinc-500">Livery: {skin}</p>}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {car && (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-700"
          >
            Change livery…
          </button>
        )}
        {overridden && (
          <button
            type="button"
            onClick={clear}
            disabled={clearing}
            title={`Go back to the ${champCar.name} the .champ entered you in`}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
          >
            {clearing ? 'Dropping…' : 'Back to the .champ car'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- the grid */

function CarCard({
  car,
  driving,
  onOpen,
}: {
  car: InstalledCar;
  driving: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group overflow-hidden rounded-lg border bg-zinc-800/50 text-left transition-colors ${
        driving
          ? 'border-cyan-500 ring-1 ring-cyan-500/40'
          : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800'
      }`}
    >
      <div className="relative aspect-video bg-zinc-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl(car.id, car.defaultSkin, true)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {driving && (
          <span className="absolute left-2 top-2 rounded bg-cyan-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-900">
            Driving
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-sm font-semibold text-white group-hover:text-cyan-400">
          {car.name}
        </div>
        <div className="truncate text-xs text-zinc-400">
          {car.brand}
          {car.year && <span className="text-zinc-500"> · {car.year}</span>}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">
          {specLine(car) || 'no specs on file'}
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------- the car's panel */

interface CarDetail {
  skins: InstalledSkin[];
  description: string;
}

function CarPanel({
  car,
  scope,
  driving,
  drivingSkin,
  onClose,
  onSaved,
}: {
  car: InstalledCar;
  scope: Scope;
  /** Whether this is the car already in the seat, which is what a livery change is. */
  driving: boolean;
  drivingSkin: string;
  onClose: () => void;
  onSaved: (pick: PlayerCarConfig) => void;
}) {
  const [detail, setDetail] = useState<CarDetail | null>(null);
  const [skin, setSkin] = useState(driving && drivingSkin ? drivingSkin : car.defaultSkin);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The liveries and the description are the two things the catalogue leaves out, so
  // they are fetched for the one car being looked at.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/cars?car=${encodeURIComponent(car.id)}`);
        if (!response.ok) return;
        const body = (await response.json()) as CarDetail;
        if (!cancelled) setDetail(body);
      } catch {
        // The panel simply shows the car without its liveries, which still saves.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [car.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/player-car', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          champ: scope.champId,
          season: scope.seasonId,
          car: { car: car.id, skin },
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? response.statusText);
        return;
      }
      const body = (await response.json()) as { car: PlayerCarConfig };
      onSaved(body.car);
    } catch {
      setError('Could not reach the server');
    } finally {
      setSaving(false);
    }
  };

  const specs = Object.entries(car.specs);
  const unchanged = driving && skin === drivingSkin;

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 sm:p-8"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* The panel is taller than the window on most cars, so the two things you came
            for — closing it, and taking the car — stay put while the rest scrolls. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-lg border-b border-zinc-700 bg-zinc-900 p-6">
          <div className="flex min-w-0 items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeUrl(car.id)}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg object-contain"
              onError={event => {
                // Plenty of mods ship no badge; the heading reads fine without one.
                event.currentTarget.style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="text-sm text-zinc-500">{car.brand}</div>
              <h2 className="truncate text-2xl font-bold text-white">{car.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {car.year && <span>{car.year}</span>}
                {car.carClass && <span className="capitalize">{car.carClass}</span>}
                {car.drivetrain && <span>{DRIVETRAIN_LABELS[car.drivetrain]}</span>}
                <span className="font-mono text-zinc-600">{car.id}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl(car.id, skin)}
            alt={car.name}
            className="aspect-video w-full rounded-lg border border-zinc-700 object-cover"
          />

          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {specs.map(([key, value]) => (
                <div key={key} className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-sm font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          )}

          {detail && detail.skins.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Livery ({detail.skins.length})
              </h3>
              <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-8">
                {detail.skins.map(livery => (
                  <button
                    key={livery.id}
                    type="button"
                    onClick={() => setSkin(livery.id)}
                    title={livery.name}
                    className={`overflow-hidden rounded border transition-colors ${
                      livery.id === skin
                        ? 'border-cyan-500 ring-1 ring-cyan-500/40'
                        : 'border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl(car.id, livery.id, true)}
                      alt=""
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                    <span className="block truncate px-1.5 py-1 text-left text-[10px] text-zinc-400">
                      {livery.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {detail?.description && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                About
              </h3>
              <div
                className="max-h-52 overflow-y-auto pr-1 text-sm leading-relaxed text-zinc-300"
                dangerouslySetInnerHTML={{ __html: detail.description }}
              />
            </div>
          )}

          {car.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {car.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-lg border-t border-zinc-700 bg-zinc-900 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || unchanged}
            title={unchanged ? 'This is already the car and livery you drive' : undefined}
            className="rounded-lg bg-cyan-500/80 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
          >
            {saving ? 'Saving…' : driving ? 'Use this livery' : 'Drive this car'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
