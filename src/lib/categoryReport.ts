import type { Category, CategoryOverrides, CategoryRule, Transaction } from './types';
import { categorize, transactionKey } from './categories';

export type CategoryTotals = {
  categoryId: string | null; // null = uncategorized
  total: number; // sum of |debits|, EUR > 0
  count: number;
  avgPerMonth: number;
  share: number; // 0..1, fraction of total spending
  pctVsAvg: number | null; // last full month vs trailing avg, e.g. 0.12 = 12% above
  monthly: Record<string, number>; // 'yyyy-MM-01' -> amount
};

export type CategoryReportInput = {
  transactions: Transaction[];
  rules: CategoryRule[];
  overrides: CategoryOverrides;
  categories: Category[];
  /** ISO 'yyyy-MM-dd' inclusive bounds. */
  fromIso: string;
  toIso: string;
};

export type CategoryReport = {
  totals: CategoryTotals[];
  totalSpend: number;
  /** Number of distinct months in the window (>=1), used to compute averages. */
  monthsInWindow: number;
  /** Sorted list of 'yyyy-MM-01' month keys spanning the window. */
  monthKeys: string[];
};

/**
 * Aggregate debits per category across a time window. Only negative amounts
 * count as spending; income is excluded. Each month in the window contributes
 * to the average even if it had zero spending in a category, so the report
 * reflects "how often does this happen on average".
 */
export function buildCategoryReport(input: CategoryReportInput): CategoryReport {
  const { transactions, rules, overrides, fromIso, toIso } = input;
  const inWindow = transactions.filter((t) => t.date >= fromIso && t.date <= toIso && t.amount < 0);
  const txCategory = categorize(inWindow, rules, overrides);

  const monthKeys = enumerateMonths(fromIso, toIso);
  const monthsInWindow = Math.max(1, monthKeys.length);

  const buckets = new Map<string | null, CategoryTotals>();
  const ensure = (id: string | null): CategoryTotals => {
    let b = buckets.get(id);
    if (!b) {
      b = {
        categoryId: id,
        total: 0,
        count: 0,
        avgPerMonth: 0,
        share: 0,
        pctVsAvg: null,
        monthly: Object.fromEntries(monthKeys.map((m) => [m, 0])),
      };
      buckets.set(id, b);
    }
    return b;
  };

  for (const t of inWindow) {
    const cat = txCategory.get(transactionKey(t)) ?? null;
    const month = `${t.date.slice(0, 7)}-01`;
    const bucket = ensure(cat);
    bucket.total = round2(bucket.total + -t.amount);
    bucket.count += 1;
    bucket.monthly[month] = round2((bucket.monthly[month] ?? 0) + -t.amount);
  }

  const totalSpend = Array.from(buckets.values()).reduce((s, b) => s + b.total, 0);

  for (const b of buckets.values()) {
    b.avgPerMonth = round2(b.total / monthsInWindow);
    b.share = totalSpend > 0 ? b.total / totalSpend : 0;
    // Compare last full month spending vs average of preceding months.
    const lastMonth = monthKeys[monthKeys.length - 1];
    if (lastMonth && monthKeys.length >= 2) {
      const trailingMonths = monthKeys.slice(0, -1);
      const trailingTotal = trailingMonths.reduce((s, m) => s + (b.monthly[m] ?? 0), 0);
      const trailingAvg = trailingTotal / trailingMonths.length;
      const lastVal = b.monthly[lastMonth] ?? 0;
      b.pctVsAvg = trailingAvg > 0 ? (lastVal - trailingAvg) / trailingAvg : null;
    }
  }

  const totals = Array.from(buckets.values()).sort((a, b) => b.total - a.total);
  return { totals, totalSpend: round2(totalSpend), monthsInWindow, monthKeys };
}

/**
 * Inclusive list of 'yyyy-MM-01' month keys covering [fromIso..toIso].
 */
function enumerateMonths(fromIso: string, toIso: string): string[] {
  if (fromIso > toIso) return [];
  const [fy, fm] = fromIso.split('-').map(Number);
  const [ty, tm] = toIso.split('-').map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
