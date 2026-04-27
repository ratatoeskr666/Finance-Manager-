import type { Account, Transaction } from '../lib/types';
import { Button } from './ui/Button';
import { formatEur } from '../lib/format';

export function AccountList({
  accounts,
  txByAccount,
  selectedId,
  onSelect,
  onEdit,
  onImport,
  onDelete,
  onCreate,
}: {
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (a: Account) => void;
  onImport: (a: Account) => void;
  onDelete: (a: Account) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-slate-800 bg-slate-900/30">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Accounts</h2>
        <Button variant="subtle" onClick={onCreate} className="!px-2 !py-1" aria-label="Add account">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <button
          className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
            selectedId === null ? 'bg-cyan-500/10 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'
          }`}
          onClick={() => onSelect(null)}
        >
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
            All accounts (combined)
          </span>
          <span className="text-xs text-slate-500">{accounts.length}</span>
        </button>
        {accounts.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-500">
            No accounts yet. Click + to create one.
          </p>
        )}
        {accounts.map((a) => {
          const txs = txByAccount[a.id] ?? [];
          const last = txs[txs.length - 1];
          const selected = selectedId === a.id;
          return (
            <div
              key={a.id}
              className={`group mb-1 rounded-lg border ${
                selected ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-transparent hover:bg-slate-800'
              }`}
            >
              <button className="flex w-full items-start justify-between px-3 py-2 text-left" onClick={() => onSelect(a.id)}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-100">{a.name}</span>
                    <span className="block text-xs text-slate-500">
                      {txs.length} tx · {last ? formatEur(last.balance) : formatEur(a.startingBalance ?? 0)}
                    </span>
                  </span>
                </span>
              </button>
              <div className="flex gap-1 px-2 pb-2 opacity-0 transition group-hover:opacity-100">
                <Button variant="subtle" className="!px-2 !py-1 text-xs" onClick={() => onImport(a)}>
                  Import CSV
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onEdit(a)}>
                  Edit
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 text-xs text-red-400 hover:!bg-red-900/30" onClick={() => onDelete(a)}>
                  Delete
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
