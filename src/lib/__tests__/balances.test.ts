import { describe, expect, it } from 'vitest';
import { deriveBalances, mergeTransactions, toDailySeries } from '../balances';
import type { Transaction } from '../types';

const tx = (id: string, date: string, amount: number, balance: number, description?: string): Transaction => ({
  id,
  accountId: 'a',
  date,
  amount,
  balance,
  description,
});

describe('deriveBalances', () => {
  it('rolls a running balance from a starting value', () => {
    const out = deriveBalances(
      [
        { id: '1', accountId: 'a', date: '2024-01-01', amount: 100 },
        { id: '2', accountId: 'a', date: '2024-01-02', amount: -25.5 },
      ],
      1000,
    );
    expect(out.map((t) => t.balance)).toEqual([1100, 1074.5]);
  });
});

describe('toDailySeries', () => {
  it('forward-fills days with no transactions', () => {
    const series = toDailySeries([
      tx('1', '2024-01-01', 0, 100),
      tx('2', '2024-01-04', 0, 150),
    ]);
    expect(series.map((p) => p.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04']);
    expect(series.map((p) => p.balance)).toEqual([100, 100, 100, 150]);
  });

  it('uses the last balance on days with multiple transactions', () => {
    const series = toDailySeries([
      tx('1', '2024-01-01', 0, 50),
      tx('2', '2024-01-01', 0, 75),
    ]);
    expect(series).toHaveLength(1);
    expect(series[0].balance).toBe(75);
  });
});

describe('mergeTransactions', () => {
  it('deduplicates by accountId|date|amount|description', () => {
    const a = tx('a1', '2024-01-01', 10, 110, 'X');
    const b = tx('b1', '2024-01-01', 10, 110, 'X');
    const merged = mergeTransactions([a], [b]);
    expect(merged).toHaveLength(1);
  });
  it('keeps distinct transactions on the same day', () => {
    const a = tx('a1', '2024-01-01', 10, 110, 'X');
    const b = tx('b1', '2024-01-01', 20, 130, 'Y');
    const merged = mergeTransactions([a], [b]);
    expect(merged).toHaveLength(2);
  });
});
