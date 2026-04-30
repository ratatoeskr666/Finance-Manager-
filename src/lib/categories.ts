import type { Category, CategoryOverrides, CategoryRule, Transaction } from './types';
import { randomId } from './format';

/**
 * Stable identifier for a transaction across re-imports. Mirrors the dedup key
 * used by mergeTransactions so manual category overrides survive re-imports.
 */
export function transactionKey(t: Pick<Transaction, 'accountId' | 'date' | 'amount' | 'description'>): string {
  return `${t.accountId}|${t.date}|${t.amount.toFixed(2)}|${(t.description ?? '').trim()}`;
}

/**
 * Match a single transaction against one rule. Returns true if the rule applies.
 * Invalid regex patterns are treated as non-matching rather than throwing.
 */
export function ruleMatches(rule: CategoryRule, tx: Transaction): boolean {
  const haystacks: string[] = [];
  if (rule.field === 'counterparty' || rule.field === 'any') haystacks.push(tx.counterparty ?? '');
  if (rule.field === 'description' || rule.field === 'any') haystacks.push(tx.description ?? '');
  if (haystacks.length === 0) return false;

  if (rule.mode === 'regex') {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i');
    } catch {
      return false;
    }
    return haystacks.some((h) => re.test(h));
  }

  const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
  if (needle === '') return false;
  return haystacks.some((h) => {
    const v = rule.caseSensitive ? h : h.toLowerCase();
    return rule.mode === 'equals' ? v.trim() === needle : v.includes(needle);
  });
}

/**
 * Resolve the category id for a transaction. Manual overrides win; otherwise
 * the first matching rule (in array order) wins. Returns null when neither
 * applies.
 */
export function resolveCategoryId(
  tx: Transaction,
  rules: CategoryRule[],
  overrides: CategoryOverrides,
): string | null {
  const key = transactionKey(tx);
  if (key in overrides) return overrides[key];
  for (const r of rules) {
    if (ruleMatches(r, tx)) return r.categoryId;
  }
  return null;
}

/**
 * Resolve categories for many transactions in one pass. Returns a Map keyed by
 * transactionKey so callers can look up cheaply.
 */
export function categorize(
  transactions: Transaction[],
  rules: CategoryRule[],
  overrides: CategoryOverrides,
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const t of transactions) out.set(transactionKey(t), resolveCategoryId(t, rules, overrides));
  return out;
}

export const UNCATEGORIZED_LABEL = 'Uncategorized';
export const UNCATEGORIZED_COLOR = '#475569';

/**
 * Sensible starter categories so first-time users have something to assign
 * transactions to. No rules — the user adds rules as they categorize.
 */
export function defaultCategories(): Category[] {
  return [
    { id: randomId(), name: 'Housing', color: '#fbbf24', icon: '🏠' },
    { id: randomId(), name: 'Groceries', color: '#34d399', icon: '🛒' },
    { id: randomId(), name: 'Eating out', color: '#fb923c', icon: '🍽️' },
    { id: randomId(), name: 'Transport', color: '#60a5fa', icon: '🚗' },
    { id: randomId(), name: 'Insurance', color: '#f87171', icon: '🛡️' },
    { id: randomId(), name: 'Utilities', color: '#facc15', icon: '💡' },
    { id: randomId(), name: 'Subscriptions', color: '#a78bfa', icon: '📱' },
    { id: randomId(), name: 'Vacation', color: '#22d3ee', icon: '✈️' },
    { id: randomId(), name: 'Health', color: '#10b981', icon: '💊' },
    { id: randomId(), name: 'Entertainment', color: '#f472b6', icon: '🎮' },
  ];
}
