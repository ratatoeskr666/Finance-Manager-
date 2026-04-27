import type { Timespan } from '../lib/types';

const OPTIONS: { value: Timespan; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

export function TimespanPicker({ value, onChange }: { value: Timespan; onChange: (v: Timespan) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1.5 transition',
            value === o.value
              ? 'bg-cyan-500/15 text-cyan-200'
              : 'text-slate-300 hover:bg-slate-800',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
