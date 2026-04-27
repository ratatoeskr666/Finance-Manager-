import type { DailyPoint, Transaction } from './types';

/**
 * Sort transactions ascending by date (and stable insertion order on ties).
 */
export function sortAsc<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

/**
 * Compute running balances from amounts when no balance column is available.
 * `startingBalance` is the balance BEFORE the first transaction.
 */
export function deriveBalances(
  transactions: Omit<Transaction, 'balance'>[],
  startingBalance: number,
): Transaction[] {
  const sorted = sortAsc(transactions);
  let running = startingBalance;
  return sorted.map((t) => {
    running = round2(running + t.amount);
    return { ...t, balance: running };
  });
}

/**
 * Reduce many same-day transactions to a single end-of-day balance,
 * carrying forward the last known balance to days with no transactions.
 * Returns daily points covering the inclusive range [first, last] dates seen.
 */
export function toDailySeries(transactions: Transaction[]): DailyPoint[] {
  if (transactions.length === 0) return [];
  const sorted = sortAsc(transactions);
  // End-of-day balance per date.
  const eod = new Map<string, number>();
  for (const t of sorted) eod.set(t.date, t.balance);

  const start = parseIso(sorted[0].date);
  const end = parseIso(sorted[sorted.length - 1].date);
  const out: DailyPoint[] = [];
  let last = sorted[0].balance;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const iso = toIsoDate(d);
    if (eod.has(iso)) last = eod.get(iso)!;
    out.push({ date: iso, balance: last });
  }
  return out;
}

/**
 * Filter daily series to a [from, to] inclusive ISO date window.
 */
export function clipSeries(series: DailyPoint[], from: string, to: string): DailyPoint[] {
  return series.filter((p) => p.date >= from && p.date <= to);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

/**
 * Merge two transaction arrays, deduplicating by id (which encodes
 * date+amount+description+rowIndex). The right-hand side wins on conflict.
 */
export function mergeTransactions(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const map = new Map<string, Transaction>();
  for (const t of existing) map.set(dedupeKey(t), t);
  for (const t of incoming) map.set(dedupeKey(t), t);
  return sortAsc(Array.from(map.values()));
}

/**
 * Dedup by date+amount+description (ignore rowIndex / accountId-suffix nuance) so
 * re-importing an overlapping CSV doesn't create duplicates.
 */
function dedupeKey(t: Transaction): string {
  return `${t.accountId}|${t.date}|${t.amount.toFixed(2)}|${(t.description ?? '').trim()}`;
}
