import { describe, expect, it } from 'vitest';
import { categorize, resolveCategoryId, ruleMatches, transactionKey } from '../categories';
import type { CategoryRule, Transaction } from '../types';

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'x',
  accountId: 'a1',
  date: '2024-01-15',
  amount: -10,
  balance: 0,
  description: 'Some payment',
  counterparty: 'Allianz Versicherung',
  ...overrides,
});

const rule = (overrides: Partial<CategoryRule> = {}): CategoryRule => ({
  id: 'r1',
  categoryId: 'cat-insurance',
  field: 'counterparty',
  mode: 'contains',
  pattern: 'allianz',
  caseSensitive: false,
  ...overrides,
});

describe('ruleMatches', () => {
  it('matches counterparty contains case-insensitively by default', () => {
    expect(ruleMatches(rule(), tx())).toBe(true);
  });
  it('respects caseSensitive flag', () => {
    expect(ruleMatches(rule({ pattern: 'allianz', caseSensitive: true }), tx())).toBe(false);
    expect(ruleMatches(rule({ pattern: 'Allianz', caseSensitive: true }), tx())).toBe(true);
  });
  it('matches description field when configured', () => {
    expect(ruleMatches(rule({ field: 'description', pattern: 'payment' }), tx())).toBe(true);
  });
  it('matches either field with field=any', () => {
    expect(ruleMatches(rule({ field: 'any', pattern: 'payment' }), tx())).toBe(true);
    expect(ruleMatches(rule({ field: 'any', pattern: 'allianz' }), tx())).toBe(true);
  });
  it('supports regex mode', () => {
    expect(ruleMatches(rule({ mode: 'regex', pattern: '^Allianz' }), tx())).toBe(true);
    expect(ruleMatches(rule({ mode: 'regex', pattern: 'XYZ$' }), tx())).toBe(false);
  });
  it('treats invalid regex as non-match instead of throwing', () => {
    expect(ruleMatches(rule({ mode: 'regex', pattern: '(' }), tx())).toBe(false);
  });
  it('equals mode trims whitespace', () => {
    expect(
      ruleMatches(rule({ mode: 'equals', pattern: 'Allianz Versicherung' }), tx({ counterparty: '  Allianz Versicherung  ' })),
    ).toBe(true);
  });
  it('returns false on missing fields', () => {
    expect(ruleMatches(rule({ field: 'counterparty', pattern: 'X' }), tx({ counterparty: undefined }))).toBe(false);
  });
});

describe('resolveCategoryId', () => {
  const rules: CategoryRule[] = [
    rule({ id: 'r1', categoryId: 'insurance', pattern: 'allianz' }),
    rule({ id: 'r2', categoryId: 'food', field: 'counterparty', pattern: 'rewe' }),
  ];

  it('first matching rule wins', () => {
    expect(resolveCategoryId(tx({ counterparty: 'Allianz' }), rules, {})).toBe('insurance');
    expect(resolveCategoryId(tx({ counterparty: 'REWE Markt' }), rules, {})).toBe('food');
  });

  it('returns null when no rule matches', () => {
    expect(resolveCategoryId(tx({ counterparty: 'Unknown' }), rules, {})).toBeNull();
  });

  it('manual override beats rules', () => {
    const t = tx({ counterparty: 'Allianz' });
    const overrides = { [transactionKey(t)]: 'manual-cat' };
    expect(resolveCategoryId(t, rules, overrides)).toBe('manual-cat');
  });

  it('manual null override forces uncategorized', () => {
    const t = tx({ counterparty: 'Allianz' });
    const overrides = { [transactionKey(t)]: null };
    expect(resolveCategoryId(t, rules, overrides)).toBeNull();
  });
});

describe('transactionKey', () => {
  it('is stable across re-imports with the same logical row', () => {
    const a = tx({ accountId: 'a1', date: '2024-01-01', amount: -12.34, description: 'X' });
    const b = tx({ accountId: 'a1', date: '2024-01-01', amount: -12.34, description: 'X', id: 'different' });
    expect(transactionKey(a)).toBe(transactionKey(b));
  });
});

describe('categorize', () => {
  it('maps every transaction to a category id or null', () => {
    const txs = [
      tx({ counterparty: 'Allianz', accountId: 'a1', date: '2024-01-01' }),
      tx({ counterparty: 'Unknown', accountId: 'a1', date: '2024-01-02' }),
    ];
    const rules: CategoryRule[] = [rule({ pattern: 'allianz', categoryId: 'insurance' })];
    const result = categorize(txs, rules, {});
    expect(result.size).toBe(2);
    expect(result.get(transactionKey(txs[0]))).toBe('insurance');
    expect(result.get(transactionKey(txs[1]))).toBeNull();
  });
});
