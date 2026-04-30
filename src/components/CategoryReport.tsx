import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Account, Category, CategoryOverrides, CategoryRule, Transaction } from '../lib/types';
import { buildCategoryReport, type CategoryTotals } from '../lib/categoryReport';
import { UNCATEGORIZED_COLOR, UNCATEGORIZED_LABEL } from '../lib/categories';
import { formatEur, formatMonth } from '../lib/format';

type Props = {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  fromIso: string;
  toIso: string;
  categories: Category[];
  rules: CategoryRule[];
  overrides: CategoryOverrides;
  onManageCategories: () => void;
};

export function CategoryReport({
  accounts,
  txByAccount,
  selectedId,
  fromIso,
  toIso,
  categories,
  rules,
  overrides,
  onManageCategories,
}: Props) {
  const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;
  const allTx = useMemo(() => visible.flatMap((a) => txByAccount[a.id] ?? []), [visible, txByAccount]);

  const report = useMemo(
    () => buildCategoryReport({ transactions: allTx, rules, overrides, categories, fromIso, toIso }),
    [allTx, rules, overrides, categories, fromIso, toIso],
  );

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const labelFor = (id: string | null) =>
    id ? categoryById.get(id)?.name ?? '(deleted category)' : UNCATEGORIZED_LABEL;
  const colorFor = (id: string | null) =>
    id ? categoryById.get(id)?.color ?? UNCATEGORIZED_COLOR : UNCATEGORIZED_COLOR;
  const iconFor = (id: string | null) => (id ? categoryById.get(id)?.icon ?? '' : '');

  if (report.totals.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
        <p>No spending in the selected timespan.</p>
        <button onClick={onManageCategories} className="text-cyan-300 hover:underline">
          Manage categories →
        </button>
      </div>
    );
  }

  const pieData = report.totals.map((t) => ({
    id: t.categoryId,
    name: labelFor(t.categoryId),
    value: t.total,
    color: colorFor(t.categoryId),
  }));

  const stackedData = report.monthKeys.map((m) => {
    const row: Record<string, string | number> = { month: m };
    for (const t of report.totals) {
      row[t.categoryId ?? '__none__'] = t.monthly[m] ?? 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-[360px] w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="85%"
                innerRadius="55%"
                paddingAngle={1}
                stroke="#0f172a"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(v, _, p) => [
                  `${formatEur(Number(v))} (${pct(Number(v), report.totalSpend)})`,
                  p.payload.name,
                ]}
              />
              <Legend wrapperStyle={{ color: '#cbd5e1', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <Stat label="Total spending" value={formatEur(report.totalSpend)} />
          <Stat
            label={`Avg / month (${report.monthsInWindow} mo)`}
            value={formatEur(report.totalSpend / report.monthsInWindow)}
          />
          <Stat label="Categories with spend" value={String(report.totals.filter((t) => t.total > 0).length)} />
          <button
            onClick={onManageCategories}
            className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            Manage categories & rules
          </button>
        </aside>
      </div>

      <CategoryTable totals={report.totals} categoryById={categoryById} totalSpend={report.totalSpend} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-100">Spending per month, stacked by category</h3>
        <div className="h-[320px] w-full">
          <ResponsiveContainer>
            <BarChart data={stackedData} margin={{ top: 10, right: 24, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(iso) => formatMonth(String(iso))}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => formatEur(Number(v), true)}
                width={88}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                labelFormatter={(iso) => formatMonth(String(iso))}
                formatter={(v, name) => [formatEur(Number(v)), labelFor(String(name) === '__none__' ? null : String(name))]}
              />
              {report.totals.map((t) => (
                <Bar
                  key={String(t.categoryId)}
                  dataKey={t.categoryId ?? '__none__'}
                  stackId="cat"
                  fill={colorFor(t.categoryId)}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Insights totals={report.totals} categoryById={categoryById} iconFor={iconFor} colorFor={colorFor} labelFor={labelFor} monthsInWindow={report.monthsInWindow} />
    </div>
  );
}

function CategoryTable({
  totals,
  categoryById,
  totalSpend,
}: {
  totals: CategoryTotals[];
  categoryById: Map<string, Category>;
  totalSpend: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2 text-right">Avg / month</th>
            <th className="px-3 py-2 text-right">% of spend</th>
            <th className="px-3 py-2 text-right">Tx count</th>
            <th className="px-3 py-2 text-right">Last vs avg</th>
            <th className="px-3 py-2 text-right">Budget Δ</th>
          </tr>
        </thead>
        <tbody>
          {totals.map((t) => {
            const cat = t.categoryId ? categoryById.get(t.categoryId) : null;
            const budget = cat?.budget;
            return (
              <tr key={String(t.categoryId)} className="border-t border-slate-800/60">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: cat?.color ?? UNCATEGORIZED_COLOR }}
                    />
                    <span className="text-slate-200">
                      {cat?.icon ? `${cat.icon} ` : ''}
                      {cat?.name ?? UNCATEGORIZED_LABEL}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-300">{formatEur(t.total)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-200">{formatEur(t.avgPerMonth)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">{pct(t.total, totalSpend)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">{t.count}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {t.pctVsAvg === null ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <span className={t.pctVsAvg > 0.05 ? 'text-rose-300' : t.pctVsAvg < -0.05 ? 'text-emerald-300' : 'text-slate-300'}>
                      {t.pctVsAvg > 0 ? '+' : ''}
                      {(t.pctVsAvg * 100).toFixed(1)}%
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {budget === undefined ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <BudgetDelta avg={t.avgPerMonth} budget={budget} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BudgetDelta({ avg, budget }: { avg: number; budget: number }) {
  const delta = avg - budget;
  const cls = delta > 0 ? 'text-rose-300' : 'text-emerald-300';
  return (
    <span className={cls}>
      {delta > 0 ? '+' : ''}
      {formatEur(delta)}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}

function Insights({
  totals,
  monthsInWindow,
  iconFor,
  colorFor,
  labelFor,
}: {
  totals: CategoryTotals[];
  categoryById: Map<string, Category>;
  monthsInWindow: number;
  iconFor: (id: string | null) => string;
  colorFor: (id: string | null) => string;
  labelFor: (id: string | null) => string;
}) {
  if (totals.length === 0 || monthsInWindow < 2) return null;
  const sorted = [...totals].filter((t) => t.total > 0);
  const topSpend = sorted[0];
  const topGrowth = [...sorted]
    .filter((t) => t.pctVsAvg !== null)
    .sort((a, b) => (b.pctVsAvg ?? 0) - (a.pctVsAvg ?? 0))[0];
  const topShrink = [...sorted]
    .filter((t) => t.pctVsAvg !== null)
    .sort((a, b) => (a.pctVsAvg ?? 0) - (b.pctVsAvg ?? 0))[0];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <InsightCard
        title="Biggest cost"
        body={`${iconFor(topSpend.categoryId)} ${labelFor(topSpend.categoryId)} costs ${formatEur(topSpend.avgPerMonth)} per month on average — ${formatEur(topSpend.total)} total.`}
        color={colorFor(topSpend.categoryId)}
      />
      {topGrowth && topGrowth.pctVsAvg !== null && topGrowth.pctVsAvg > 0.1 && (
        <InsightCard
          title="Trending up"
          body={`${iconFor(topGrowth.categoryId)} ${labelFor(topGrowth.categoryId)} spending in the last month was ${(topGrowth.pctVsAvg * 100).toFixed(0)}% above its trailing average — worth a look.`}
          color={colorFor(topGrowth.categoryId)}
        />
      )}
      {topShrink && topShrink.pctVsAvg !== null && topShrink.pctVsAvg < -0.1 && (
        <InsightCard
          title="Trending down"
          body={`${iconFor(topShrink.categoryId)} ${labelFor(topShrink.categoryId)} spending dropped ${Math.abs(topShrink.pctVsAvg * 100).toFixed(0)}% versus its trailing average. Nice.`}
          color={colorFor(topShrink.categoryId)}
        />
      )}
    </div>
  );
}

function InsightCard({ title, body, color }: { title: string; body: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {title}
      </div>
      <p className="mt-2 text-sm text-slate-200">{body}</p>
    </div>
  );
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}
