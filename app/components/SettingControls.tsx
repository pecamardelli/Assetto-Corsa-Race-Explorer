'use client';

/**
 * The form controls the settings editors are built from — game presets, race
 * specs — so every settings screen in the app reads the same way.
 */

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-5">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">{title}</h3>
      <div className="divide-y divide-zinc-700/50">{children}</div>
    </div>
  );
}

export function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2" title={hint}>
      <span className="text-sm text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? 'bg-green-500/80' : 'bg-zinc-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max,
  step,
  format,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  step: number;
  format: (value: number) => string;
}) {
  return (
    <div className="py-2" title={hint}>
      <div className="mb-1 flex items-center justify-between gap-4">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="text-xs font-mono text-zinc-400">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="w-full accent-green-500"
      />
    </div>
  );
}

export function NumberInput({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2" title={hint}>
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          // An emptied box reads as NaN, which would wipe the value while typing.
          onChange={event => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-20 rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-right text-sm text-white focus:border-green-500 focus:outline-none"
        />
        {suffix && <span className="w-8 text-xs text-zinc-500">{suffix}</span>}
      </span>
    </label>
  );
}

export function Select<T extends string | number>({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2" title={hint}>
      <span className="text-sm text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={event => {
          const raw = event.target.value;
          onChange((typeof value === 'number' ? Number(raw) : raw) as T);
        }}
        className="min-w-[10rem] rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-1 text-sm text-white focus:border-green-500 focus:outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
