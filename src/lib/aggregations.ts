import type { Account, Transaction } from './types';

export type MonthlyBucket = {
  month: string; // ISO 'yyyy-MM-01' as label key
  spending: number; // positive number, sum of |debits|
  income: number;
  net: number;
  count: number;
  /** per-account breakdown of spending in this month */
  perAccount: Record<string, number>;
};

/**
 * Group transactions by calendar month and split into spending (sum of negative
 * amounts, expressed as a positive number) and income.
 */
export function monthlySpending(
  transactions: Transaction[],
  accounts: Account[],
): MonthlyBucket[] {
  const accountIds = new Set(accounts.map((a) => a.id));
  const visible = transactions.filter((t) => accountIds.has(t.accountId));
  const byMonth = new Map<string, MonthlyBucket>();
  for (const t of visible) {
    const key = `${t.date.slice(0, 7)}-01`;
    let b = byMonth.get(key);
    if (!b) {
      b = { month: key, spending: 0, income: 0, net: 0, count: 0, perAccount: {} };
      byMonth.set(key, b);
    }
    if (t.amount < 0) b.spending += -t.amount;
    else b.income += t.amount;
    b.net += t.amount;
    b.count += 1;
    if (t.amount < 0) {
      b.perAccount[t.accountId] = (b.perAccount[t.accountId] ?? 0) + -t.amount;
    }
  }
  return Array.from(byMonth.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
}

export type CounterpartySlice = {
  label: string;
  amount: number; // positive total spend
  count: number;
};

const NORMALIZE_RX = /\s+/g;

/**
 * Normalize a counterparty name so trivial casing/whitespace differences cluster
 * onto the same slice. Keeps the original-cased label of the most frequent variant.
 */
function normalizeKey(raw: string): string {
  return raw.trim().replace(NORMALIZE_RX, ' ').toLowerCase();
}

/**
 * Aggregate debit transactions by counterparty into a list of pie-chart slices.
 * Slices below `topN` are rolled into a single "Other" bucket. Transactions
 * without a counterparty are bucketed as "(unspecified)".
 */
export function debitsByCounterparty(
  transactions: Transaction[],
  accounts: Account[],
  topN = 10,
): { slices: CounterpartySlice[]; total: number } {
  const accountIds = new Set(accounts.map((a) => a.id));
  const debits = transactions.filter((t) => accountIds.has(t.accountId) && t.amount < 0);

  type Bucket = { label: string; amount: number; count: number; variants: Map<string, number> };
  const map = new Map<string, Bucket>();
  for (const t of debits) {
    const raw = (t.counterparty ?? '').trim();
    const key = raw === '' ? '__unspecified__' : normalizeKey(raw);
    const display = raw === '' ? '(unspecified)' : raw;
    let b = map.get(key);
    if (!b) {
      b = { label: display, amount: 0, count: 0, variants: new Map() };
      map.set(key, b);
    }
    b.amount += -t.amount;
    b.count += 1;
    b.variants.set(display, (b.variants.get(display) ?? 0) + 1);
    // Use the most-seen original casing as the display label.
    let bestVariant = b.label;
    let bestCount = b.variants.get(bestVariant) ?? 0;
    for (const [variant, count] of b.variants) {
      if (count > bestCount) {
        bestVariant = variant;
        bestCount = count;
      }
    }
    b.label = bestVariant;
  }

  const slices: CounterpartySlice[] = Array.from(map.values())
    .map((b) => ({ label: b.label, amount: round2(b.amount), count: b.count }))
    .sort((a, b) => b.amount - a.amount);

  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (slices.length <= topN) return { slices, total };

  const top = slices.slice(0, topN);
  const rest = slices.slice(topN);
  const other: CounterpartySlice = {
    label: `Other (${rest.length})`,
    amount: round2(rest.reduce((s, x) => s + x.amount, 0)),
    count: rest.reduce((s, x) => s + x.count, 0),
  };
  return { slices: [...top, other], total };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
