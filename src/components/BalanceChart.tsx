import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Account, DailyPoint, PrognosisMethod, Transaction } from '../lib/types';
import { addDays, addMonths, clipSeries, parseIso, toDailySeries, toIsoDate } from '../lib/balances';
import { projectFuture } from '../lib/prognosis';
import { formatEur, formatMonth } from '../lib/format';
import { DayTooltip } from './DayTooltip';
import type { InflationMode, InflationSeries } from '../lib/inflation';
import { indexAt } from '../lib/inflation';

type Props = {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  fromIso: string;
  toIso: string;
  prognosisMethod: PrognosisMethod;
  prognosisHorizon: number;
  showCombined: boolean;
  inflation?: {
    enabled: boolean;
    mode: InflationMode;
    series: InflationSeries | null;
    anchorDate?: string;
  };
};

type ChartRow = {
  date: string;
  [key: string]: number | string | null | undefined;
};

export function BalanceChart({
  accounts,
  txByAccount,
  selectedId,
  fromIso,
  toIso,
  prognosisMethod,
  prognosisHorizon,
  showCombined,
  inflation,
}: Props) {
  const view = useMemo(
    () =>
      buildChart({
        accounts,
        txByAccount,
        selectedId,
        fromIso,
        toIso,
        prognosisMethod,
        prognosisHorizon,
        showCombined,
        inflation,
      }),
    [accounts, txByAccount, selectedId, fromIso, toIso, prognosisMethod, prognosisHorizon, showCombined, inflation],
  );

  if (view.data.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        No data in the selected timespan. Import a CSV or widen the timespan.
      </div>
    );
  }

  return (
    <div className="h-[460px] w-full">
      <ResponsiveContainer>
        <ComposedChart data={view.data} margin={{ top: 10, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(iso) => formatMonth(iso)}
            minTickGap={48}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(v) => formatEur(Number(v), true)}
            width={88}
          />
          {view.cpiAxis && (
            <YAxis
              yAxisId="cpi"
              orientation="right"
              tick={{ fill: '#fbbf24', fontSize: 12 }}
              tickFormatter={(v) => Number(v).toFixed(1)}
              width={56}
              label={{ value: 'CPI', angle: 90, position: 'insideRight', fill: '#fbbf24', fontSize: 11 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
            content={<DayTooltip accounts={accounts} txByAccount={txByAccount} selectedId={selectedId} />}
          />
          <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
          {view.prognosisStart && (
            <ReferenceLine
              yAxisId="left"
              x={view.prognosisStart}
              stroke="#475569"
              strokeDasharray="4 4"
              label={{ value: 'now', position: 'top', fill: '#94a3b8', fontSize: 11 }}
            />
          )}
          {view.lines.map((l) => (
            <Line
              key={l.key}
              yAxisId={l.axis ?? 'left'}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color}
              strokeWidth={l.bold ? 2.5 : 2}
              strokeDasharray={l.dashed ? '6 4' : undefined}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          {view.bandKey && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey={view.bandKey}
              name="Confidence band"
              stroke="none"
              fill="#22d3ee"
              fillOpacity={0.08}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildChart({
  accounts,
  txByAccount,
  selectedId,
  fromIso,
  toIso,
  prognosisMethod,
  prognosisHorizon,
  showCombined,
  inflation,
}: Props) {
  const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;
  if (visible.length === 0)
    return {
      data: [] as ChartRow[],
      lines: [] as { key: string; name: string; color: string; dashed?: boolean; bold?: boolean; axis?: 'left' | 'cpi' }[],
      prognosisStart: null as string | null,
      bandKey: undefined as string | undefined,
      cpiAxis: false,
    };

  const seriesByAccount: Record<string, DailyPoint[]> = {};
  for (const a of visible) seriesByAccount[a.id] = toDailySeries(txByAccount[a.id] ?? []);

  // Collect all dates across visible accounts.
  const dateSet = new Set<string>();
  for (const a of visible) for (const p of seriesByAccount[a.id]) dateSet.add(p.date);
  if (dateSet.size === 0) return { data: [], lines: [], prognosisStart: null, bandKey: undefined };

  // Build forward-filled per-account values across all dates so combined view sums correctly.
  const allDates = Array.from(dateSet).sort();
  const filled: Record<string, Map<string, number>> = {};
  for (const a of visible) {
    const map = new Map<string, number>();
    let last = a.startingBalance ?? 0;
    const series = seriesByAccount[a.id];
    let si = 0;
    for (const d of allDates) {
      while (si < series.length && series[si].date <= d) {
        last = series[si].balance;
        si++;
      }
      map.set(d, last);
    }
    filled[a.id] = map;
  }

  // Slice to selected timespan.
  const visibleDates = allDates.filter((d) => d >= fromIso && d <= toIso);

  // Prognosis: compute per visible account, then sum for combined.
  const lastDate = allDates[allDates.length - 1];
  const projections: Record<string, Map<string, { v: number; up?: number; lo?: number }>> = {};
  if (prognosisHorizon > 0) {
    for (const a of visible) {
      const sliced = clipSeries(
        seriesByAccount[a.id],
        toIsoDate(addMonths(parseIso(lastDate), -6)),
        lastDate,
      );
      const proj = projectFuture({ series: sliced, method: prognosisMethod, horizonMonths: prognosisHorizon });
      const m = new Map<string, { v: number; up?: number; lo?: number }>();
      for (const p of proj) m.set(p.date, { v: p.balance, up: p.upper, lo: p.lower });
      projections[a.id] = m;
    }
  }
  const futureDates: string[] = [];
  if (prognosisHorizon > 0) {
    let cursor = addDays(parseIso(lastDate), 1);
    const end = addMonths(parseIso(lastDate), prognosisHorizon);
    while (cursor <= end) {
      futureDates.push(toIsoDate(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  const dates = [...visibleDates, ...futureDates];

  const data: ChartRow[] = dates.map((d) => {
    const isFuture = d > lastDate;
    const row: ChartRow = { date: d };
    let combined = 0;
    let combinedFuture = 0;
    let bandUpper: number | null = null;
    let bandLower: number | null = null;

    for (const a of visible) {
      const histVal = filled[a.id].get(d);
      const proj = projections[a.id]?.get(d);
      if (!isFuture) {
        row[a.id] = histVal ?? null;
        row[`${a.id}_proj`] = null;
        if (histVal !== undefined) combined += histVal;
      } else {
        row[a.id] = null;
        row[`${a.id}_proj`] = proj?.v ?? null;
        if (proj) combinedFuture += proj.v;
        if (proj?.up !== undefined && proj?.lo !== undefined) {
          // For single-account view show band; for combined we don't aggregate the band.
          bandUpper = (bandUpper ?? 0) + proj.up;
          bandLower = (bandLower ?? 0) + proj.lo;
        }
      }
    }

    if (showCombined && visible.length > 1) {
      row['__total'] = isFuture ? null : combined;
      row['__total_proj'] = isFuture ? combinedFuture : null;
    } else if (visible.length === 1 && bandUpper !== null && bandLower !== null) {
      row[`${visible[0].id}_band`] = [bandLower, bandUpper] as unknown as number;
    }
    return row;
  });

  const lines: { key: string; name: string; color: string; dashed?: boolean; bold?: boolean; axis?: 'left' | 'cpi' }[] = [];
  for (const a of visible) {
    lines.push({ key: a.id, name: a.name, color: a.color });
    if (prognosisHorizon > 0) lines.push({ key: `${a.id}_proj`, name: `${a.name} (prognosis)`, color: a.color, dashed: true });
  }
  if (showCombined && visible.length > 1) {
    lines.push({ key: '__total', name: 'Total', color: '#f8fafc', bold: true });
    if (prognosisHorizon > 0) lines.push({ key: '__total_proj', name: 'Total (prognosis)', color: '#f8fafc', bold: true, dashed: true });
  }

  const bandKey = visible.length === 1 && prognosisMethod === 'linear' && prognosisHorizon > 0 ? `${visible[0].id}_band` : undefined;

  // Inflation overlay.
  let cpiAxis = false;
  if (inflation?.enabled && inflation.series && data.length > 0) {
    const cpi = inflation.series;
    if (inflation.mode === 'index') {
      // Plot the raw CPI index on the right axis.
      cpiAxis = true;
      for (const row of data) {
        const v = indexAt(cpi, String(row.date));
        row['__cpi'] = v ?? null;
      }
      lines.push({ key: '__cpi', name: `${cpi.countryName} CPI`, color: '#fbbf24', dashed: true, axis: 'cpi' });
    } else {
      // Real-value mode: re-express each total/account in the anchor month's purchasing power.
      const anchor = inflation.anchorDate ?? String(data[0].date);
      const anchorIdx = indexAt(cpi, anchor);
      if (anchorIdx !== null) {
        const isCombinedView = showCombined && visible.length > 1;
        for (const row of data) {
          const cpiAt = indexAt(cpi, String(row.date));
          if (cpiAt === null || cpiAt === 0) {
            row['__real_total'] = null;
            for (const a of visible) row[`${a.id}_real`] = null;
            continue;
          }
          const factor = anchorIdx / cpiAt;
          if (isCombinedView) {
            const total = typeof row['__total'] === 'number' ? (row['__total'] as number) : null;
            row['__real_total'] = total === null ? null : round2(total * factor);
          } else {
            for (const a of visible) {
              const v = typeof row[a.id] === 'number' ? (row[a.id] as number) : null;
              row[`${a.id}_real`] = v === null ? null : round2(v * factor);
            }
          }
        }
        if (isCombinedView) {
          lines.push({
            key: '__real_total',
            name: `Total (real, ${cpi.countryName} CPI @ ${anchor.slice(0, 7)})`,
            color: '#fbbf24',
            dashed: true,
            bold: true,
          });
        } else {
          for (const a of visible) {
            lines.push({
              key: `${a.id}_real`,
              name: `${a.name} (real @ ${anchor.slice(0, 7)})`,
              color: '#fbbf24',
              dashed: true,
            });
          }
        }
      }
    }
  }

  return {
    data,
    lines,
    prognosisStart: prognosisHorizon > 0 ? lastDate : null,
    bandKey,
    cpiAxis,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
