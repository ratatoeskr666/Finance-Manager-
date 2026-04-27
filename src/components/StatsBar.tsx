import type { Account, Transaction } from '../lib/types';
import { formatEur } from '../lib/format';
import { Card } from './ui/Card';

export function StatsBar({
  accounts,
  txByAccount,
  selectedId,
}: {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
}) {
  const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;

  const stats = visible.map((a) => {
    const txs = txByAccount[a.id] ?? [];
    const last = txs[txs.length - 1];
    const balance = last?.balance ?? a.startingBalance ?? 0;
    const last30 = txs.filter((t) => t.date >= isoMonthsAgo(1));
    const incoming = last30.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const outgoing = last30.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    return { account: a, balance, incoming, outgoing, txCount: txs.length };
  });

  const totalBalance = stats.reduce((s, x) => s + x.balance, 0);
  const totalIn = stats.reduce((s, x) => s + x.incoming, 0);
  const totalOut = stats.reduce((s, x) => s + x.outgoing, 0);
  const totalTx = stats.reduce((s, x) => s + x.txCount, 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label={selectedId ? 'Balance' : 'Total balance'} value={formatEur(totalBalance)} accent="text-cyan-300" />
      <Stat label="Income (30d)" value={formatEur(totalIn)} accent="text-emerald-300" />
      <Stat label="Spending (30d)" value={formatEur(totalOut)} accent="text-rose-300" />
      <Stat label="Transactions" value={String(totalTx)} accent="text-slate-100" />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card>
      <div className="px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
        <div className={['mt-1 text-xl font-semibold tabular-nums', accent].join(' ')}>{value}</div>
      </div>
    </Card>
  );
}

function isoMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
