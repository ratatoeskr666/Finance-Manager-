import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { Account, Transaction } from '../lib/types';
import { debitsByCounterparty } from '../lib/aggregations';
import { formatEur, paletteColor } from '../lib/format';

type Props = {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  fromIso: string;
  toIso: string;
};

export function CounterpartyPieChart({ accounts, txByAccount, selectedId, fromIso, toIso }: Props) {
  const { slices, total, anyCounterparty } = useMemo(() => {
    const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;
    const allTx: Transaction[] = visible.flatMap((a) => txByAccount[a.id] ?? []);
    const inWindow = allTx.filter((t) => t.date >= fromIso && t.date <= toIso);
    const result = debitsByCounterparty(inWindow, visible, 10);
    const anyCounterparty = inWindow.some((t) => t.counterparty);
    return { ...result, anyCounterparty };
  }, [accounts, txByAccount, selectedId, fromIso, toIso]);

  if (slices.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        No debit transactions in the selected timespan.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 h-[460px] w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius="85%"
              innerRadius="55%"
              paddingAngle={1}
              isAnimationActive={false}
              stroke="#0f172a"
              strokeWidth={2}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={paletteColor(i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v, _, p) => [
                `${formatEur(Number(v))} (${pct(Number(v), total)})`,
                p.payload.label,
              ]}
            />
            <Legend
              wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }}
              formatter={(_, _entry, i) => slices[i]?.label ?? ''}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <aside className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Top recipients</h3>
          <span className="text-xs text-slate-400">{formatEur(total)} total</span>
        </div>
        {!anyCounterparty && (
          <p className="mb-3 rounded bg-amber-900/30 p-2 text-xs text-amber-200">
            No counterparty column was mapped on import — re-import with a counterparty/payee
            column for richer slices.
          </p>
        )}
        <ol className="space-y-2 text-sm">
          {slices.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: paletteColor(i) }} />
              <span className="min-w-0 flex-1 truncate text-slate-200" title={s.label}>
                {s.label}
              </span>
              <span className="tabular-nums text-slate-400">{pct(s.amount, total)}</span>
              <span className="w-20 text-right tabular-nums text-rose-300">{formatEur(s.amount)}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}
