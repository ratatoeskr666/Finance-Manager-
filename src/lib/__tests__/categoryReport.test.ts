import { describe, expect, it } from 'vitest';
import { buildCategoryReport } from '../categoryReport';
import type { Category, CategoryRule, Transaction } from '../types';

const tx = (date: string, amount: number, counterparty?: string): Transaction => ({
  id: `${date}-${amount}-${counterparty ?? ''}`,
  accountId: 'a1',
  date,
  amount,
  balance: 0,
  counterparty,
});

const cats: Category[] = [
  { id: 'food', name: 'Food', color: '#0f0' },
  { id: 'insurance', name: 'Insurance', color: '#f00' },
];

const rules: CategoryRule[] = [
  { id: 'r1', categoryId: 'food', field: 'counterparty', mode: 'contains', pattern: 'rewe' },
  { id: 'r2', categoryId: 'insurance', field: 'counterparty', mode: 'contains', pattern: 'allianz' },
];

describe('buildCategoryReport', () => {
  it('aggregates debits per category, ignoring credits', () => {
    const transactions = [
      tx('2024-01-05', -20, 'REWE'),
      tx('2024-01-12', -15, 'REWE'),
      tx('2024-01-15', -50, 'Allianz'),
      tx('2024-01-20', 1000, 'Salary'), // credit, ignored
      tx('2024-02-04', -30, 'Unknown'), // uncategorized
    ];
    const r = buildCategoryReport({
      transactions,
      rules,
      overrides: {},
      categories: cats,
      fromIso: '2024-01-01',
      toIso: '2024-02-29',
    });

    const food = r.totals.find((t) => t.categoryId === 'food')!;
    const insurance = r.totals.find((t) => t.categoryId === 'insurance')!;
    const uncat = r.totals.find((t) => t.categoryId === null)!;

    expect(food.total).toBe(35);
    expect(insurance.total).toBe(50);
    expect(uncat.total).toBe(30);

    expect(r.totalSpend).toBe(115);
    expect(r.monthsInWindow).toBe(2);
    // monthKeys covers Jan + Feb.
    expect(r.monthKeys).toEqual(['2024-01-01', '2024-02-01']);
  });

  it('computes avgPerMonth as total / monthsInWindow', () => {
    const transactions = [tx('2024-01-15', -60, 'REWE'), tx('2024-03-10', -120, 'REWE')];
    const r = buildCategoryReport({
      transactions,
      rules,
      overrides: {},
      categories: cats,
      fromIso: '2024-01-01',
      toIso: '2024-03-31',
    });
    const food = r.totals.find((t) => t.categoryId === 'food')!;
    expect(food.total).toBe(180);
    expect(r.monthsInWindow).toBe(3);
    expect(food.avgPerMonth).toBe(60);
  });

  it('share is fraction of total spend', () => {
    const transactions = [tx('2024-01-15', -50, 'REWE'), tx('2024-01-15', -150, 'Allianz')];
    const r = buildCategoryReport({
      transactions,
      rules,
      overrides: {},
      categories: cats,
      fromIso: '2024-01-01',
      toIso: '2024-01-31',
    });
    const food = r.totals.find((t) => t.categoryId === 'food')!;
    const insurance = r.totals.find((t) => t.categoryId === 'insurance')!;
    expect(food.share).toBeCloseTo(0.25, 6);
    expect(insurance.share).toBeCloseTo(0.75, 6);
  });

  it('pctVsAvg compares last month to trailing average', () => {
    const transactions = [
      tx('2024-01-15', -100, 'REWE'),
      tx('2024-02-15', -100, 'REWE'),
      tx('2024-03-15', -200, 'REWE'), // last month: 100% above trailing avg of 100
    ];
    const r = buildCategoryReport({
      transactions,
      rules,
      overrides: {},
      categories: cats,
      fromIso: '2024-01-01',
      toIso: '2024-03-31',
    });
    const food = r.totals.find((t) => t.categoryId === 'food')!;
    expect(food.pctVsAvg).toBeCloseTo(1, 6);
  });

  it('returns empty totals when no debits in window', () => {
    const r = buildCategoryReport({
      transactions: [tx('2024-01-15', 200, 'Salary')],
      rules,
      overrides: {},
      categories: cats,
      fromIso: '2024-01-01',
      toIso: '2024-01-31',
    });
    expect(r.totals).toEqual([]);
    expect(r.totalSpend).toBe(0);
  });
});
