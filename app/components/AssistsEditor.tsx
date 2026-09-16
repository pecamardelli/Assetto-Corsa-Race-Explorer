'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ASSIST_LEVELS,
  AssistLevel,
  AssistsConfig,
  AssistsSource,
} from '../types/assists';
import {
  DEFAULT_TRAFFIC,
  TRAFFIC_CARS_MAX,
  TRAFFIC_CARS_MIN,
  TRAFFIC_CARS_SLIDER_MAX,
  TRAFFIC_PER_LANE_KM_MAX,
  TrafficConfig,
} from '../types/traffic-preset';
import { Group, NumberInput, Slider, Toggle } from './SettingControls';

/**
 * Edit form for the game presets AC reads at launch. Without a scope it edits the
 * global config; with one it edits a single season, where saving creates that
 * season's override and "Use global" removes it.
 *
 * Driving aids have one more layer than that: a season more than one of us drives lets
 * each driver keep their own, over the season's, and the picker at the top of the form
 * says which of the two a save is going to. The traffic never splits that way — how
 * busy a road is belongs to the round.
 */

interface SeasonScope {
  champId: string;
  seasonId: string;
}

const LEVEL_LABELS: Record<AssistLevel, string> = {
  off: 'Off',
  factory: 'Factory',
  on: 'On',
};

function LevelPicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: AssistLevel;
  onChange: (next: AssistLevel) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2" title={hint}>
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-zinc-600">
        {ASSIST_LEVELS.map(level => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`px-3 py-1 text-xs font-semibold transition-colors ${
              value === level
                ? 'bg-green-500/30 text-green-300'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}

const percent = (value: number) => `${value}%`;
const multiplier = (value: number) => (value === 0 ? 'Off' : `${value}x`);
const perLaneKm = (value: number) => `${value} / lane-km`;

/**
 * What a density works out to on a few roads that have a lane plan, so the slider
 * means something before a race is launched. The figure is lane-kilometres *within the
 * simulation's 1.5 km reach* of a typical point on the road (`TrafficRoad.reachKm`), not
 * the road's length: the cars all live around the player, so a 33 km loop is spread no
 * thinner than a 3.6 km one. Measured 2026-09-05 from the installed plans.
 */
const REFERENCE_ROADS: Array<{ name: string; laneKm: number }> = [
  { name: 'New Forest (3.6 km loop)', laneKm: 7.3 },
  { name: 'Bannochbrae (7.3 km loop)', laneKm: 13.5 },
  { name: 'Evo Triangle (32.7 km loop)', laneKm: 6.9 },
  { name: 'Transfăgărășan (23.4 km pass)', laneKm: 14.1 },
];

export default function AssistsEditor({
  initial,
  initialTraffic,
  initialSource,
  scope,
  playerName,
}: {
  initial: AssistsConfig;
  initialTraffic?: TrafficConfig;
  initialSource: AssistsSource;
  scope?: SeasonScope;
  /** Whoever is driving, when the season is one more than one of us drives. */
  playerName?: string;
}) {
  const [assists, setAssists] = useState<AssistsConfig>(initial);
  const [traffic, setTraffic] = useState<TrafficConfig>(initialTraffic ?? DEFAULT_TRAFFIC);
  const [source, setSource] = useState<AssistsSource>(initialSource);
  // Which layer a save writes to. It opens on the layer the values came from, so
  // saving without touching it puts them back where they were.
  const [mine, setMine] = useState(initialSource === 'player');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const set = <K extends keyof AssistsConfig>(key: K, value: AssistsConfig[K]) => {
    setAssists(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const setTrafficField = <K extends keyof TrafficConfig>(key: K, value: TrafficConfig[K]) => {
    setTraffic(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const request = async (init: RequestInit, url = '/api/assists') => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(url, init);
      const body = (await response.json()) as {
        assists?: AssistsConfig;
        traffic?: TrafficConfig;
        source?: AssistsSource;
        error?: string;
      };

      if (!response.ok) {
        setError(body.error ?? response.statusText);
        return;
      }

      if (body.assists) setAssists(body.assists);
      if (body.traffic) setTraffic(body.traffic);
      if (body.source) setSource(body.source);
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setSaving(false);
    }
  };

  const save = () =>
    request({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        scope
          ? { assists, traffic, champ: scope.champId, season: scope.seasonId, mine }
          : { assists, traffic }
      ),
    });

  const revert = (own: boolean) =>
    request(
      { method: 'DELETE' },
      `/api/assists?champ=${encodeURIComponent(scope!.champId)}&season=${encodeURIComponent(
        scope!.seasonId
      )}${own ? '&mine=1' : ''}`
    );

  return (
    <div className="space-y-4">
      {scope && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            source === 'global'
              ? 'border-zinc-600 bg-zinc-800/50 text-zinc-400'
              : source === 'player'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                : 'border-purple-500/30 bg-purple-500/10 text-purple-300'
          }`}
        >
          {source === 'global'
            ? 'This season follows the global presets. Saving here gives it its own copy.'
            : source === 'player'
              ? `${playerName ?? 'This driver'} drives this season on their own aids. The season's own are what everybody else gets.`
              : 'This season has its own presets. Global changes will not touch it.'}
        </div>
      )}

      {/* Who a save belongs to. The aids AC is given at launch are the driver's where
          they keep their own, so two people can share a season without sharing a
          gearbox — while the traffic, which is the road's and not anybody's, always
          saves with the season. */}
      {scope && playerName && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3">
          <span className="text-sm text-zinc-400">These aids are</span>
          <div className="flex overflow-hidden rounded-lg border border-zinc-600">
            <button
              type="button"
              onClick={() => setMine(false)}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                mine
                  ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                  : 'bg-purple-500/30 text-purple-200'
              }`}
            >
              The season&apos;s
            </button>
            <button
              type="button"
              onClick={() => setMine(true)}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                mine
                  ? 'bg-cyan-500/30 text-cyan-200'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
              }`}
            >
              {playerName}&apos;s own
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Group title="Transmission">
          <Toggle
            label="Automatic gearbox"
            hint="The game shifts for you"
            value={assists.autoShifter}
            onChange={value => set('autoShifter', value)}
          />
          <Toggle
            label="Automatic clutch"
            value={assists.autoClutch}
            onChange={value => set('autoClutch', value)}
          />
          <Toggle
            label="Throttle blip"
            hint="Automatic blip on downshifts"
            value={assists.autoBlip}
            onChange={value => set('autoBlip', value)}
          />
        </Group>

        <Group title="Braking & Traction">
          <LevelPicker
            label="ABS"
            hint="Factory: only cars that really had it"
            value={assists.abs}
            onChange={value => set('abs', value)}
          />
          <LevelPicker
            label="Traction control"
            hint="Factory: only cars that really had it"
            value={assists.tractionControl}
            onChange={value => set('tractionControl', value)}
          />
          <Slider
            label="Stability control"
            value={assists.stabilityControl}
            onChange={value => set('stabilityControl', value)}
            max={100}
            step={5}
            format={percent}
          />
          <Toggle
            label="Automatic braking"
            value={assists.autoBrake}
            onChange={value => set('autoBrake', value)}
          />
        </Group>

        <Group title="Driving Aids">
          <Toggle
            label="Ideal racing line"
            value={assists.idealLine}
            onChange={value => set('idealLine', value)}
          />
          <Toggle
            label="Tyre blankets"
            hint="Tyres start the session warm"
            value={assists.tyreBlankets}
            onChange={value => set('tyreBlankets', value)}
          />
        </Group>

        <Group title="Traffic">
          <p className="pb-2 text-xs text-zinc-500">
            Cars the Test Drive mode puts on the road, on rounds raced in traffic. Other
            rounds ignore this.
          </p>

          <Toggle
            label="Set the car count myself"
            hint="Off: the count is worked out from the road's own lane plan"
            value={traffic.cars !== null}
            onChange={enabled =>
              setTrafficField(
                'cars',
                enabled
                  ? Math.round(
                      Math.min(
                        TRAFFIC_CARS_MAX,
                        Math.max(TRAFFIC_CARS_MIN, REFERENCE_ROADS[0].laneKm * traffic.perLaneKm)
                      )
                    )
                  : null
              )
            }
          />

          {traffic.cars !== null ? (
            <>
              <Slider
                label="Traffic cars"
                hint="Every road gets this many, however long or short it is"
                value={Math.min(traffic.cars, TRAFFIC_CARS_SLIDER_MAX)}
                onChange={value => setTrafficField('cars', value)}
                min={TRAFFIC_CARS_MIN}
                max={TRAFFIC_CARS_SLIDER_MAX}
                step={1}
                format={value => `${value} cars`}
              />
              <NumberInput
                label="Exact count"
                hint={`The mode accepts ${TRAFFIC_CARS_MIN} to ${TRAFFIC_CARS_MAX}`}
                value={traffic.cars}
                onChange={value => setTrafficField('cars', value)}
                min={TRAFFIC_CARS_MIN}
                max={TRAFFIC_CARS_MAX}
                suffix="cars"
              />
            </>
          ) : (
            <>
              <Slider
                label="Density"
                hint="Cars per lane-km within 1.5 km of you: the simulation keeps its traffic around the player, not spread along the road. A two-way road counts twice"
                value={traffic.perLaneKm}
                onChange={value => setTrafficField('perLaneKm', value)}
                min={1}
                max={TRAFFIC_PER_LANE_KM_MAX}
                step={0.5}
                format={perLaneKm}
              />
              <div className="space-y-1 py-2 text-xs text-zinc-500">
                {REFERENCE_ROADS.map(road => (
                  <div key={road.name} className="flex justify-between gap-4">
                    <span>{road.name}</span>
                    <span className="font-mono text-zinc-400">
                      {Math.max(
                        TRAFFIC_CARS_MIN,
                        Math.round(road.laneKm * traffic.perLaneKm)
                      )}{' '}
                      cars
                      <span className="ml-2 text-zinc-600">
                        one every{' '}
                        {Math.round(
                          (road.laneKm * 1000) /
                            Math.max(
                              TRAFFIC_CARS_MIN,
                              Math.round(road.laneKm * traffic.perLaneKm)
                            )
                        )}{' '}
                        m
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Group>

        <Group title="Realism">
          <Slider
            label="Mechanical damage"
            value={assists.damage}
            onChange={value => set('damage', value)}
            max={100}
            step={5}
            format={percent}
          />
          <Toggle
            label="Visual damage"
            value={assists.visualDamage}
            onChange={value => set('visualDamage', value)}
          />
          <Slider
            label="Fuel consumption"
            hint="1x is realistic"
            value={assists.fuelRate}
            onChange={value => set('fuelRate', value)}
            max={5}
            step={0.25}
            format={multiplier}
          />
          <Slider
            label="Tyre wear"
            hint="1x is realistic"
            value={assists.tyreWear}
            onChange={value => set('tyreWear', value)}
            max={5}
            step={0.25}
            format={multiplier}
          />
          <Slider
            label="Slipstream effect"
            hint="1x is realistic"
            value={assists.slipstream}
            onChange={value => set('slipstream', value)}
            max={5}
            step={0.25}
            format={multiplier}
          />
        </Group>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-green-500/20 px-6 py-2 text-sm font-semibold text-green-400 transition-all hover:bg-green-500/30 hover:shadow-lg hover:shadow-green-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? 'Saving…'
            : !scope
              ? 'Save'
              : mine
                ? `Save as ${playerName ?? 'mine'}'s`
                : source === 'global'
                  ? 'Save for this season'
                  : 'Save for this season'}
        </button>

        {scope && source === 'season' && (
          <button
            type="button"
            onClick={() => revert(false)}
            disabled={saving}
            title="Drop this season's presets and follow the global config again"
            className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use global presets
          </button>
        )}

        {scope && source === 'player' && (
          <button
            type="button"
            onClick={() => revert(true)}
            disabled={saving}
            title="Drop this driver's own aids and drive the season's"
            className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use the season&apos;s aids
          </button>
        )}

        {saved && !saving && <span className="text-sm text-green-400">Saved</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
