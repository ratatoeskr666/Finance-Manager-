import type { PrognosisMethod } from '../lib/types';

export function PrognosisControls({
  method,
  onMethodChange,
  horizon,
  onHorizonChange,
}: {
  method: PrognosisMethod;
  onMethodChange: (m: PrognosisMethod) => void;
  horizon: number;
  onHorizonChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prognosis</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        <button
          onClick={() => onMethodChange('linear')}
          className={method === 'linear' ? 'bg-cyan-500/15 px-3 py-1.5 text-cyan-200' : 'px-3 py-1.5 text-slate-300 hover:bg-slate-800'}
          title="Linear regression of last 6 months"
        >
          Linear
        </button>
        <button
          onClick={() => onMethodChange('avgNet')}
          className={method === 'avgNet' ? 'bg-cyan-500/15 px-3 py-1.5 text-cyan-200' : 'px-3 py-1.5 text-slate-300 hover:bg-slate-800'}
          title="Average monthly net change of last 6 months"
        >
          Avg net
        </button>
      </div>
      <label className="flex items-center gap-2 text-slate-300">
        <span className="text-xs text-slate-500">horizon</span>
        <input
          type="range"
          min={0}
          max={24}
          value={horizon}
          onChange={(e) => onHorizonChange(Number(e.target.value))}
          className="accent-cyan-400"
        />
        <span className="w-12 tabular-nums text-xs text-slate-400">{horizon} mo</span>
      </label>
    </div>
  );
}
