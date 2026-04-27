import { useMemo, useState } from 'react';
import { AccountForm } from './components/AccountForm';
import { AccountList } from './components/AccountList';
import { BalanceChart } from './components/BalanceChart';
import { CounterpartyPieChart } from './components/CounterpartyPieChart';
import { CsvImportDialog } from './components/CsvImportDialog';
import { MonthlySpendingChart } from './components/MonthlySpendingChart';
import { PrognosisControls } from './components/PrognosisControls';
import { StatsBar } from './components/StatsBar';
import { TimespanPicker } from './components/TimespanPicker';
import { Card } from './components/ui/Card';
import { Modal } from './components/ui/Modal';
import { useAppState } from './hooks/useAppState';
import { addMonths, parseIso, toIsoDate } from './lib/balances';
import type { Account, ChartView, Timespan } from './lib/types';
import { exportAll, importAll } from './lib/storage';
import { Button } from './components/ui/Button';

export function App() {
  const { state, upsertAccount, removeAccount, addTransactions, updateSettings } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timespan, setTimespan] = useState<Timespan>('6M');
  const [view, setView] = useState<ChartView>('balance');
  const [editing, setEditing] = useState<Account | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [importingFor, setImportingFor] = useState<Account | null>(null);

  const { fromIso, toIso } = useMemo(() => spanToRange(state, selectedId, timespan), [state, selectedId, timespan]);

  if (!state.loaded) {
    return <div className="flex h-full items-center justify-center text-slate-400">Loading…</div>;
  }

  const importJson = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        await importAll(text);
        location.reload();
      } catch (e) {
        alert(`Import failed: ${e}`);
      }
    };
    input.click();
  };

  const exportJson = async () => {
    const json = await exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-manager-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full bg-slate-950">
      <AccountList
        accounts={state.accounts}
        txByAccount={state.txByAccount}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={() => setCreatingNew(true)}
        onEdit={setEditing}
        onImport={setImportingFor}
        onDelete={(a) => {
          if (confirm(`Delete account "${a.name}" and all its transactions?`)) {
            void removeAccount(a.id);
            if (selectedId === a.id) setSelectedId(null);
          }
        }}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-100">
              {selectedId ? state.accounts.find((a) => a.id === selectedId)?.name : 'All accounts'}
            </h1>
            <p className="text-sm text-slate-400">
              {state.accounts.length} {state.accounts.length === 1 ? 'account' : 'accounts'} · all data lives locally in your browser.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={exportJson} title="Download a JSON backup of all data">
              Export
            </Button>
            <Button variant="ghost" onClick={importJson} title="Restore from a JSON backup">
              Import
            </Button>
          </div>
        </header>

        <StatsBar accounts={state.accounts} txByAccount={state.txByAccount} selectedId={selectedId} />

        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <ViewTabs value={view} onChange={setView} />
            <div className="flex flex-wrap items-center gap-3">
              <TimespanPicker value={timespan} onChange={setTimespan} />
              {view === 'balance' && (
                <PrognosisControls
                  method={state.settings.prognosisMethod}
                  onMethodChange={(m) => updateSettings({ prognosisMethod: m })}
                  horizon={state.settings.prognosisHorizonMonths}
                  onHorizonChange={(n) => updateSettings({ prognosisHorizonMonths: n })}
                />
              )}
            </div>
          </div>
          <div className="p-4">
            {view === 'balance' && (
              <BalanceChart
                accounts={state.accounts}
                txByAccount={state.txByAccount}
                selectedId={selectedId}
                fromIso={fromIso}
                toIso={toIso}
                prognosisMethod={state.settings.prognosisMethod}
                prognosisHorizon={state.settings.prognosisHorizonMonths}
                showCombined={state.settings.showCombined}
              />
            )}
            {view === 'monthly' && (
              <MonthlySpendingChart
                accounts={state.accounts}
                txByAccount={state.txByAccount}
                selectedId={selectedId}
                fromIso={fromIso}
                toIso={toIso}
              />
            )}
            {view === 'counterparty' && (
              <CounterpartyPieChart
                accounts={state.accounts}
                txByAccount={state.txByAccount}
                selectedId={selectedId}
                fromIso={fromIso}
                toIso={toIso}
              />
            )}
          </div>
        </Card>

        {state.accounts.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <h2 className="text-lg font-medium text-slate-100">Welcome 👋</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Create an account, choose a bank preset (Sparkasse, VR, Postbank, Commerzbank or custom), then import your CSV
              export. Everything stays in your browser — nothing is uploaded.
            </p>
            <div className="mt-4">
              <Button onClick={() => setCreatingNew(true)}>Create your first account</Button>
            </div>
          </div>
        )}
      </main>

      <Modal open={creatingNew} onClose={() => setCreatingNew(false)} title="New account">
        <AccountForm
          existingCount={state.accounts.length}
          onCancel={() => setCreatingNew(false)}
          onSave={async (a) => {
            await upsertAccount(a);
            setCreatingNew(false);
            setSelectedId(a.id);
          }}
        />
      </Modal>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={`Edit — ${editing.name}`}>
          <AccountForm
            initial={editing}
            existingCount={state.accounts.length}
            onCancel={() => setEditing(null)}
            onSave={async (a) => {
              await upsertAccount(a);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {importingFor && (
        <CsvImportDialog
          open
          account={importingFor}
          onClose={() => setImportingFor(null)}
          onImport={(txs) => addTransactions(importingFor.id, txs)}
        />
      )}
    </div>
  );
}

function ViewTabs({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const TABS: { value: ChartView; label: string }[] = [
    { value: 'balance', label: 'Balances' },
    { value: 'monthly', label: 'Monthly spending' },
    { value: 'counterparty', label: 'By recipient' },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-sm">
      {TABS.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={[
            'px-3 py-1.5 transition',
            value === t.value ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-300 hover:bg-slate-800',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function spanToRange(state: { accounts: { id: string; startingBalance?: number }[]; txByAccount: Record<string, { date: string }[]> }, selectedId: string | null, span: Timespan) {
  // The reference "now" is the last transaction date across visible accounts (or today if none).
  const visible = selectedId ? state.accounts.filter((a) => a.id === selectedId) : state.accounts;
  const lastDates = visible.flatMap((a) => state.txByAccount[a.id] ?? []).map((t) => t.date);
  const last = lastDates.length > 0 ? lastDates.sort().slice(-1)[0] : toIsoDate(new Date());
  if (span === 'ALL') {
    const first = lastDates.length > 0 ? lastDates.sort()[0] : toIsoDate(addMonths(new Date(), -6));
    return { fromIso: first, toIso: last };
  }
  const months = span === '1M' ? 1 : span === '3M' ? 3 : span === '6M' ? 6 : 12;
  return { fromIso: toIsoDate(addMonths(parseIso(last), -months)), toIso: last };
}
