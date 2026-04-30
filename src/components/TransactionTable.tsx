import { useMemo, useState } from 'react';
import type { Account, Category, CategoryOverrides, CategoryRule, Transaction } from '../lib/types';
import { categorize, transactionKey, UNCATEGORIZED_LABEL } from '../lib/categories';
import { formatDate, formatEur } from '../lib/format';
import { Select, TextInput } from './ui/Field';

const AUTO_VALUE = '__auto__';
const NONE_VALUE = '__none__';

type Props = {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  fromIso: string;
  toIso: string;
  categories: Category[];
  rules: CategoryRule[];
  overrides: CategoryOverrides;
  onSetOverride: (txKey: string, categoryId: string | null | undefined) => void;
  onSetOverridesBulk: (txKeys: string[], categoryId: string | null | undefined) => void;
};

export function TransactionTable({
  accounts,
  txByAccount,
  selectedId,
  fromIso,
  toIso,
  categories,
  rules,
  overrides,
  onSetOverride,
  onSetOverridesBulk,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'debit' | 'credit' | 'uncategorized'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = selectedId ? accounts.filter((a) => a.id === selectedId) : accounts;
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const allTx: Transaction[] = useMemo(
    () => visible.flatMap((a) => txByAccount[a.id] ?? []),
    [visible, txByAccount],
  );

  const txInWindow = useMemo(
    () => allTx.filter((t) => t.date >= fromIso && t.date <= toIso),
    [allTx, fromIso, toIso],
  );

  const txCategory = useMemo(() => categorize(txInWindow, rules, overrides), [txInWindow, rules, overrides]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return txInWindow
      .filter((t) => {
        if (filter === 'debit' && t.amount >= 0) return false;
        if (filter === 'credit' && t.amount < 0) return false;
        if (filter === 'uncategorized') {
          const cat = txCategory.get(transactionKey(t));
          if (cat) return false;
        }
        if (!needle) return true;
        return (
          (t.counterparty ?? '').toLowerCase().includes(needle) ||
          (t.description ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [txInWindow, txCategory, filter, search]);

  const allSelectedKey = filtered.every((t) => selected.has(transactionKey(t))) && filtered.length > 0;

  const toggleSelectAll = () => {
    if (allSelectedKey) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => transactionKey(t))));
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onBulk = (val: string) => {
    const keys = Array.from(selected);
    if (val === AUTO_VALUE) onSetOverridesBulk(keys, undefined);
    else if (val === NONE_VALUE) onSetOverridesBulk(keys, null);
    else onSetOverridesBulk(keys, val);
    setSelected(new Set());
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search counterparty or description…"
          className="!max-w-xs"
        />
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="!max-w-[180px]">
          <option value="all">All transactions</option>
          <option value="debit">Debits only</option>
          <option value="credit">Credits only</option>
          <option value="uncategorized">Uncategorized only</option>
        </Select>
        <span className="text-xs text-slate-400">
          {filtered.length} shown · {selected.size} selected
        </span>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Assign:</span>
            <Select onChange={(e) => onBulk(e.target.value)} value="" className="!max-w-[200px]">
              <option value="" disabled>
                Choose category…
              </option>
              <option value={AUTO_VALUE}>↺ Auto (use rules)</option>
              <option value={NONE_VALUE}>— Mark uncategorized —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelectedKey}
                  onChange={toggleSelectAll}
                  className="accent-cyan-400"
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Counterparty / Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No transactions match the current filter.
                </td>
              </tr>
            )}
            {filtered.map((t) => {
              const key = transactionKey(t);
              const account = accountById.get(t.accountId);
              const overridden = key in overrides;
              const resolvedId = txCategory.get(key) ?? null;
              const cat = resolvedId ? categoryById.get(resolvedId) : null;
              const dropdownValue = overridden
                ? overrides[key] === null
                  ? NONE_VALUE
                  : overrides[key] ?? AUTO_VALUE
                : AUTO_VALUE;
              return (
                <tr key={key} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleSelect(key)}
                      className="accent-cyan-400"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-300 tabular-nums">{formatDate(t.date)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <span className="h-2 w-2 rounded-full" style={{ background: account?.color ?? '#888' }} />
                      <span className="truncate">{account?.name ?? t.accountId}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-100">{t.counterparty || '—'}</div>
                    {t.description && (
                      <div className="truncate text-xs text-slate-500" title={t.description}>
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td
                    className={[
                      'px-3 py-2 text-right tabular-nums',
                      t.amount < 0 ? 'text-rose-300' : 'text-emerald-300',
                    ].join(' ')}
                  >
                    {formatEur(t.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: cat?.color ?? '#475569' }}
                        aria-hidden
                      />
                      <select
                        value={dropdownValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === AUTO_VALUE) onSetOverride(key, undefined);
                          else if (v === NONE_VALUE) onSetOverride(key, null);
                          else onSetOverride(key, v);
                        }}
                        className="rounded border border-slate-700 bg-slate-950/60 px-2 py-1 text-xs text-slate-100"
                        title={overridden ? 'Manual assignment' : 'Auto (rule)'}
                      >
                        <option value={AUTO_VALUE}>{cat ? `↺ ${cat.icon ?? ''} ${cat.name}` : `↺ ${UNCATEGORIZED_LABEL}`}</option>
                        <option value={NONE_VALUE}>— {UNCATEGORIZED_LABEL} —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon ? `${c.icon} ` : ''}
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
