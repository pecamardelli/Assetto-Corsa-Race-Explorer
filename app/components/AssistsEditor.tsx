'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ASSIST_LEVELS,
  AssistLevel,
  AssistsConfig,
  AssistsSource,
} from '../types/assists';
import { Group, Slider, Toggle } from './SettingControls';

/**
 * Edit form for the game presets AC reads at launch. Without a scope it edits the
 * global config; with one it edits a single season, where saving creates that
 * season's override and "Use global" removes it.
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

export default function AssistsEditor({
  initial,
  initialSource,
  scope,
}: {
  initial: AssistsConfig;
  initialSource: AssistsSource;
  scope?: SeasonScope;
}) {
  const [assists, setAssists] = useState<AssistsConfig>(initial);
  const [source, setSource] = useState<AssistsSource>(initialSource);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const set = <K extends keyof AssistsConfig>(key: K, value: AssistsConfig[K]) => {
    setAssists(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const request = async (init: RequestInit, url = '/api/assists') => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(url, init);
      const body = (await response.json()) as {
        assists?: AssistsConfig;
        source?: AssistsSource;
        error?: string;
      };

      if (!response.ok) {
        setError(body.error ?? response.statusText);
        return;
      }

      if (body.assists) setAssists(body.assists);
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
          ? { assists, champ: scope.champId, season: scope.seasonId }
          : { assists }
      ),
    });

  const revertToGlobal = () =>
    request(
      { method: 'DELETE' },
      `/api/assists?champ=${encodeURIComponent(scope!.champId)}&season=${encodeURIComponent(
        scope!.seasonId
      )}`
    );

  return (
    <div className="space-y-4">
      {scope && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            source === 'season'
              ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
              : 'border-zinc-600 bg-zinc-800/50 text-zinc-400'
          }`}
        >
          {source === 'season'
            ? 'This season has its own presets. Global changes will not touch it.'
            : 'This season follows the global presets. Saving here gives it its own copy.'}
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
          {saving ? 'Saving…' : scope && source === 'global' ? 'Save for this season' : 'Save'}
        </button>

        {scope && source === 'season' && (
          <button
            type="button"
            onClick={revertToGlobal}
            disabled={saving}
            title="Drop this season's presets and follow the global config again"
            className="rounded-lg bg-zinc-700/50 px-4 py-2 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Use global presets
          </button>
        )}

        {saved && !saving && <span className="text-sm text-green-400">Saved</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
