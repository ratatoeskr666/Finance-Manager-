import { describe, expect, it } from 'vitest';
import { debitsByCounterparty, monthlySpending } from '../aggregations';
import type { Account, Transaction } from '../types';

const account = (id: string, color = '#fff'): Account => ({
  id,
  name: id.toUpperCase(),
  color,
  presetId: 'custom',
  mapping: { date: 'd', amount: 'a' },
  delimiter: ';',
  encoding: 'utf-8',
  decimal: ',',
  dateFormat: 'dd.MM.yyyy',
  startingBalance: 0,
  currency: 'EUR',
  createdAt: '2024-01-01T00:00:00Z',
});

const tx = (
  accountId: string,
  date: string,
  amount: number,
  counterparty?: string,
): Transaction => ({
  id: `${accountId}-${date}-${amount}-${counterparty ?? ''}`,
  accountId,
  date,
  amount,
  balance: 0,
  counterparty,
});

describe('monthlySpending', () => {
  it('groups debits and credits by month', () => {
    const accs = [account('a1')];
    const txs = [
      tx('a1', '2024-01-05', -10),
      tx('a1', '2024-01-20', -25.5),
      tx('a1', '2024-01-25', 200),
      tx('a1', '2024-02-01', -100),
    ];
    const buckets = monthlySpending(txs, accs);
    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toMatchObject({ month: '2024-01-01', spending: 35.5, income: 200, net: 164.5, count: 3 });
    expect(buckets[1]).toMatchObject({ month: '2024-02-01', spending: 100, income: 0, net: -100, count: 1 });
  });

  it('breaks spending down per account', () => {
    const accs = [account('a1'), account('a2')];
    const txs = [tx('a1', '2024-03-01', -10), tx('a2', '2024-03-15', -40)];
    const [bucket] = monthlySpending(txs, accs);
    expect(bucket.perAccount).toEqual({ a1: 10, a2: 40 });
  });

  it('returns empty for no transactions', () => {
    expect(monthlySpending([], [account('a1')])).toEqual([]);
  });
});

describe('debitsByCounterparty', () => {
  it('clusters case- and whitespace-insensitively', () => {
    const accs = [account('a1')];
    const txs = [
      tx('a1', '2024-01-01', -10, 'Amazon  EU'),
      tx('a1', '2024-01-02', -20, 'amazon eu'),
      tx('a1', '2024-01-03', -30, 'AMAZON EU'),
    ];
    const { slices, total } = debitsByCounterparty(txs, accs);
    expect(slices).toHaveLength(1);
    expect(slices[0].amount).toBe(60);
    expect(total).toBe(60);
  });

  it('ignores credits and unrecognized accounts', () => {
    const accs = [account('a1')];
    const txs = [
      tx('a1', '2024-01-01', 100, 'Salary'), // credit, ignored
      tx('a2', '2024-01-01', -50, 'Other'), // wrong account
      tx('a1', '2024-01-02', -25, 'Rewe'),
    ];
    const { slices, total } = debitsByCounterparty(txs, accs);
    expect(slices).toHaveLength(1);
    expect(slices[0].label).toBe('Rewe');
    expect(total).toBe(25);
  });

  it('rolls overflow into a single Other bucket beyond topN', () => {
    const accs = [account('a1')];
    const txs = Array.from({ length: 12 }, (_, i) => tx('a1', '2024-01-01', -(i + 1), `payee_${i}`));
    const { slices } = debitsByCounterparty(txs, accs, 5);
    expect(slices).toHaveLength(6); // 5 + 1 "Other"
    expect(slices[5].label).toMatch(/^Other \(/);
    const totalAcrossSlices = slices.reduce((s, x) => s + x.amount, 0);
    const expected = txs.reduce((s, t) => s + -t.amount, 0);
    expect(totalAcrossSlices).toBeCloseTo(expected, 2);
  });

  it('buckets transactions without counterparty as (unspecified)', () => {
    const accs = [account('a1')];
    const txs = [tx('a1', '2024-01-01', -10), tx('a1', '2024-01-02', -20)];
    const { slices } = debitsByCounterparty(txs, accs);
    expect(slices).toHaveLength(1);
    expect(slices[0].label).toBe('(unspecified)');
    expect(slices[0].amount).toBe(30);
  });
});
