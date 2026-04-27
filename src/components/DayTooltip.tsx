import type { Account, Transaction } from '../lib/types';
import { formatDate, formatEur } from '../lib/format';

type Props = {
  active?: boolean;
  label?: string;
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
};

/**
 * Recharts custom tooltip that, in addition to balance values, lists every
 * transaction booked on the hovered day across the visible accounts.
 */
export function DayTooltip({ active, label, accounts, txByAccount, selectedId }: Props) {
  if (!active || !label || typeof label !== 'string') return null;
  const isFuture = label > todayIso();
  const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;

  type Row = { account: Account; tx: Transaction };
  const rows: Row[] = [];
  let dayBalanceTotal = 0;
  let dayBalanceMissing = false;

  for (const a of visible) {
    const txs = (txByAccount[a.id] ?? []).filter((t) => t.date === label);
    for (const t of txs) rows.push({ account: a, tx: t });
    const last = lastBalanceUpTo(txByAccount[a.id] ?? [], label, a.startingBalance ?? 0);
    if (last === null) dayBalanceMissing = true;
    else dayBalanceTotal += last;
  }

  return (
    <div className="max-w-md rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl shadow-slate-950/50 backdrop-blur-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-medium text-slate-100">{formatDate(label)}</span>
        {!dayBalanceMissing && (
          <span className="tabular-nums text-cyan-300">
            {visible.length > 1 ? 'Total: ' : ''}
            {formatEur(dayBalanceTotal)}
          </span>
        )}
      </div>
      {isFuture ? (
        <p className="text-slate-400">Projected — no booked transactions.</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400">No transactions on this day.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 12).map((r, i) => (
            <li key={r.tx.id + i} className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: r.account.color }}
                aria-label={r.account.name}
                title={r.account.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-100">
                  {r.tx.counterparty || r.tx.description || '—'}
                </span>
                {r.tx.counterparty && r.tx.description && (
                  <span className="block truncate text-slate-500">{r.tx.description}</span>
                )}
              </span>
              <span
                className={[
                  'tabular-nums whitespace-nowrap',
                  r.tx.amount < 0 ? 'text-rose-300' : 'text-emerald-300',
                ].join(' ')}
              >
                {formatEur(r.tx.amount)}
              </span>
            </li>
          ))}
          {rows.length > 12 && (
            <li className="text-slate-500">+ {rows.length - 12} more transactions on this day</li>
          )}
        </ul>
      )}
    </div>
  );
}

function lastBalanceUpTo(txs: Transaction[], iso: string, fallback: number): number | null {
  let last: number | null = null;
  let seenAny = false;
  for (const t of txs) {
    if (t.date <= iso) {
      last = t.balance;
      seenAny = true;
    } else break;
  }
  if (!seenAny && txs.length > 0) return fallback;
  return last;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
