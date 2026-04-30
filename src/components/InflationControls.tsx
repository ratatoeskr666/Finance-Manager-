import { useState } from 'react';
import {
  COUNTRIES,
  fetchInflationSeries,
  type InflationSeries,
  type InflationSettings,
} from '../lib/inflation';
import { Modal } from './ui/Modal';
import { Label, Select, TextInput } from './ui/Field';
import { Button } from './ui/Button';

type Props = {
  settings: InflationSettings;
  series: InflationSeries | null;
  onChange: (patch: Partial<InflationSettings>) => void;
  onSeriesUpdate: (s: InflationSeries) => void | Promise<void>;
};

export function InflationControls({ settings, series, onChange, onSeriesUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const country = COUNTRIES.find((c) => c.code === settings.countryCode);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inflation</span>
      <button
        onClick={() => onChange({ enabled: !settings.enabled })}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-slate-700 transition',
          settings.enabled ? 'bg-cyan-500/30' : 'bg-slate-800',
        ].join(' ')}
        aria-pressed={settings.enabled}
        title={settings.enabled ? 'Hide inflation overlay' : 'Show inflation overlay'}
      >
        <span
          className={[
            'pointer-events-none inline-block h-5 w-5 translate-y-[1px] transform rounded-full bg-slate-200 shadow transition',
            settings.enabled ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
      {settings.enabled && (
        <>
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
            <button
              onClick={() => onChange({ mode: 'real' })}
              className={
                settings.mode === 'real'
                  ? 'bg-cyan-500/15 px-3 py-1.5 text-cyan-200'
                  : 'px-3 py-1.5 text-slate-300 hover:bg-slate-800'
              }
              title="Replot the balance in the purchasing power of the anchor month"
            >
              Real value
            </button>
            <button
              onClick={() => onChange({ mode: 'index' })}
              className={
                settings.mode === 'index'
                  ? 'bg-cyan-500/15 px-3 py-1.5 text-cyan-200'
                  : 'px-3 py-1.5 text-slate-300 hover:bg-slate-800'
              }
              title="Show the raw CPI index on a secondary right-side axis"
            >
              CPI index
            </button>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            title="Configure inflation source"
          >
            {country?.name ?? settings.countryCode}
            <span className="ml-1 text-slate-500">⚙</span>
          </button>
        </>
      )}
      <SourceModal
        open={open}
        onClose={() => setOpen(false)}
        settings={settings}
        series={series}
        onChange={onChange}
        onSeriesUpdate={onSeriesUpdate}
      />
    </div>
  );
}

function SourceModal({
  open,
  onClose,
  settings,
  series,
  onChange,
  onSeriesUpdate,
}: {
  open: boolean;
  onClose: () => void;
  settings: InflationSettings;
  series: InflationSeries | null;
  onChange: (patch: Partial<InflationSettings>) => void;
  onSeriesUpdate: (s: InflationSeries) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const country = COUNTRIES.find((c) => c.code === settings.countryCode);
      const next = await fetchInflationSeries(
        settings.countryCode,
        country?.name ?? settings.countryCode,
        settings.customUrl,
      );
      await onSeriesUpdate(next);
      setInfo(`Loaded ${next.monthly.length} monthly observations · last: ${next.monthly[next.monthly.length - 1]?.date.slice(0, 7)}`);
    } catch (e) {
      setError(`Could not refresh: ${(e as Error).message}. Check your network and the URL — Eurostat occasionally rate-limits.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Inflation data source" size="md">
      <div className="space-y-4">
        <div>
          <Label>Country / region</Label>
          <Select
            value={settings.countryCode}
            onChange={(e) => {
              setInfo(null);
              setError(null);
              onChange({ countryCode: e.target.value });
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.code})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            Default Germany (DE). Bundled snapshot ships with the app; click Refresh to load live data into the cache.
          </p>
        </div>
        <div>
          <Label>Anchor month (real-value mode)</Label>
          <TextInput
            value={settings.anchorDate ?? ''}
            placeholder="auto — first visible balance"
            onChange={(e) => onChange({ anchorDate: e.target.value || undefined })}
          />
          <p className="mt-1 text-xs text-slate-500">
            Format <code className="text-slate-400">yyyy-MM-01</code>. Defines whose purchasing power the real-value line uses. Leave blank to anchor at the first point in the visible window.
          </p>
        </div>
        <div>
          <Label>Custom data URL (advanced)</Label>
          <TextInput
            value={settings.customUrl ?? ''}
            placeholder="optional — Eurostat by default"
            onChange={(e) => onChange({ customUrl: e.target.value || undefined })}
          />
          <p className="mt-1 text-xs text-slate-500">
            Either an Eurostat JSON-stat URL or your own JSON matching the InflationSeries schema.
          </p>
        </div>
        {series && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span>
                <span className="text-slate-500">Source:</span> {series.source}
              </span>
              <span>
                <span className="text-slate-500">Index:</span> {series.index} ({series.unit})
              </span>
              <span>
                <span className="text-slate-500">Points:</span> {series.monthly.length}
              </span>
              <span>
                <span className="text-slate-500">Range:</span> {series.monthly[0]?.date.slice(0, 7)} – {series.monthly[series.monthly.length - 1]?.date.slice(0, 7)}
              </span>
              <span>
                <span className="text-slate-500">Fetched:</span> {new Date(series.fetchedAt).toLocaleString('de-DE')}
              </span>
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{error}</p>}
        {info && <p className="rounded-lg bg-emerald-900/30 p-3 text-sm text-emerald-200">{info}</p>}
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={refresh} disabled={busy}>
            {busy ? 'Refreshing…' : 'Refresh from Eurostat'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
