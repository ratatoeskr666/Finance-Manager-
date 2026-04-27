import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Account, Transaction } from '../lib/types';
import { monthlySpending } from '../lib/aggregations';
import { formatEur, formatMonth } from '../lib/format';

type Props = {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  fromIso: string;
  toIso: string;
};

export function MonthlySpendingChart({ accounts, txByAccount, selectedId, fromIso, toIso }: Props) {
  const view = useMemo(() => {
    const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;
    const allTx: Transaction[] = visible.flatMap((a) => txByAccount[a.id] ?? []);
    const inWindow = allTx.filter((t) => t.date >= fromIso && t.date <= toIso);
    const buckets = monthlySpending(inWindow, visible);
    const series = buckets.map((b) => {
      const row: Record<string, string | number> = {
        month: b.month,
        spending: round2(b.spending),
        income: round2(b.income),
        net: round2(b.net),
      };
      for (const a of visible) {
        row[a.id] = round2(b.perAccount[a.id] ?? 0);
      }
      return row;
    });
    return { series, visible };
  }, [accounts, txByAccount, selectedId, fromIso, toIso]);

  if (view.series.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        No transactions in the selected timespan.
      </div>
    );
  }

  return (
    <div className="h-[460px] w-full">
      <ResponsiveContainer>
        <LineChart data={view.series} margin={{ top: 10, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(iso) => formatMonth(iso)}
            minTickGap={32}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(v) => formatEur(Number(v), true)}
            width={88}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
            labelFormatter={(iso) => formatMonth(String(iso))}
            formatter={(v, name) => [formatEur(Number(v)), labelFor(name, view.visible)]}
          />
          <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} formatter={(v) => labelFor(v, view.visible)} />
          {view.visible.length > 1 &&
            view.visible.map((a) => (
              <Line
                key={a.id}
                type="monotone"
                dataKey={a.id}
                name={a.id}
                stroke={a.color}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          <Line
            type="monotone"
            dataKey="spending"
            name="spending"
            stroke="#f87171"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="income"
            name="income"
            stroke="#34d399"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="net"
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="2 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelFor(key: unknown, visible: Account[]): string {
  if (typeof key !== 'string') return String(key);
  if (key === 'spending') return 'Spending';
  if (key === 'income') return 'Income';
  if (key === 'net') return 'Net';
  const acc = visible.find((a) => a.id === key);
  return acc ? `${acc.name} (spend)` : key;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
