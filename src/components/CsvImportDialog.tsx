import { useEffect, useMemo, useState } from 'react';
import { detectDelimiter, parseCsvText, readFileAsText } from '../lib/csv';
import { attachBalances, parseRows } from '../lib/parseRows';
import { deriveBalances, sortAsc } from '../lib/balances';
import type { Account, ColumnMapping, Transaction } from '../lib/types';
import { Button } from './ui/Button';
import { Label, Select, TextInput } from './ui/Field';
import { ColumnMapper } from './ColumnMapper';
import { Modal } from './ui/Modal';

const ENCODINGS = ['utf-8', 'iso-8859-1', 'iso-8859-15', 'windows-1252'];
const DELIMITERS = [
  { label: 'Semicolon ( ; )', value: ';' },
  { label: 'Comma ( , )', value: ',' },
  { label: 'Tab', value: '\t' },
  { label: 'Pipe ( | )', value: '|' },
];

export function CsvImportDialog({
  open,
  account,
  onClose,
  onImport,
}: {
  open: boolean;
  account: Account;
  onClose: () => void;
  onImport: (txs: Transaction[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>('');
  const [encoding, setEncoding] = useState(account.encoding);
  const [delimiter, setDelimiter] = useState(account.delimiter);
  const [skipLines, setSkipLines] = useState(0);
  const [decimal, setDecimal] = useState<',' | '.'>(account.decimal);
  const [dateFormat, setDateFormat] = useState(account.dateFormat);
  const [mapping, setMapping] = useState<ColumnMapping>(account.mapping);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setText('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    setEncoding(account.encoding);
    setDelimiter(account.delimiter);
    setDecimal(account.decimal);
    setDateFormat(account.dateFormat);
    setMapping(account.mapping);
  }, [account.id, account.encoding, account.delimiter, account.decimal, account.dateFormat, account.mapping]);

  // Re-decode the file when encoding changes.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const t = await readFileAsText(file, encoding);
      if (cancelled) return;
      setText(t);
      // Auto-detect delimiter on first load only.
      if (!delimiter) setDelimiter(detectDelimiter(t.slice(0, 2048)));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, encoding]);

  const parsed = useMemo(() => {
    if (!text) return null;
    try {
      return parseCsvText(text, { delimiter, encoding, skipLines });
    } catch (e) {
      setError(String(e));
      return null;
    }
  }, [text, delimiter, encoding, skipLines]);

  // When new headers come in, ensure mapping references valid columns.
  useEffect(() => {
    if (!parsed) return;
    if (parsed.headers.length === 0) return;
    setMapping((prev) => ({
      date: parsed.headers.includes(prev.date) ? prev.date : parsed.headers[0],
      amount: parsed.headers.includes(prev.amount) ? prev.amount : parsed.headers[1] ?? parsed.headers[0],
      balance: prev.balance && parsed.headers.includes(prev.balance) ? prev.balance : undefined,
      description: prev.description && parsed.headers.includes(prev.description) ? prev.description : undefined,
    }));
  }, [parsed]);

  const previewRows = parsed?.rows.slice(0, 5) ?? [];

  const onConfirm = () => {
    if (!parsed) return;
    const { transactions, errors } = parseRows(parsed.rows, {
      mapping,
      decimal,
      dateFormat,
      accountId: account.id,
    });
    if (transactions.length === 0) {
      setError(`No rows could be parsed.${errors[0] ? ` First error: ${errors[0].reason}` : ''}`);
      return;
    }
    let final: Transaction[];
    if (mapping.balance) {
      const withBalance = attachBalances(parsed.rows, transactions, mapping, decimal);
      if (!withBalance) {
        setError('Could not parse balance column. Try unmapping it to derive from amounts instead.');
        return;
      }
      final = sortAsc(withBalance);
    } else {
      final = deriveBalances(transactions, account.startingBalance ?? 0);
    }
    onImport(final);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Import CSV — ${account.name}`} size="xl">
      <div className="space-y-5">
        {!file && (
          <FileDrop
            onFile={(f) => {
              setFile(f);
              setError(null);
            }}
          />
        )}
        {file && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                <span className="text-slate-500">File:</span> {file.name} <span className="text-slate-500">·</span>{' '}
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <Button variant="ghost" onClick={() => setFile(null)}>
                Choose another file
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>Delimiter</Label>
                <Select value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
                  {DELIMITERS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Encoding</Label>
                <Select value={encoding} onChange={(e) => setEncoding(e.target.value)}>
                  {ENCODINGS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Decimal</Label>
                <Select value={decimal} onChange={(e) => setDecimal(e.target.value as ',' | '.')}>
                  <option value=",">Comma (1.234,56)</option>
                  <option value=".">Dot (1,234.56)</option>
                </Select>
              </div>
              <div>
                <Label>Date format</Label>
                <TextInput value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} />
              </div>
              <div>
                <Label>Skip lines before header</Label>
                <TextInput
                  type="number"
                  min={0}
                  value={skipLines}
                  onChange={(e) => setSkipLines(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
            {parsed && parsed.headers.length > 0 && (
              <>
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Map columns</h3>
                  <ColumnMapper headers={parsed.headers} mapping={mapping} onChange={setMapping} />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</h3>
                  <div className="max-h-64 overflow-auto rounded-lg border border-slate-800">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/60">
                        <tr>
                          {parsed.headers.map((h) => (
                            <th key={h} className="px-2 py-1.5 text-left font-medium text-slate-300">
                              {h}
                              {h === mapping.date && <span className="ml-1 text-cyan-400">date</span>}
                              {h === mapping.amount && <span className="ml-1 text-emerald-400">amount</span>}
                              {h === mapping.balance && <span className="ml-1 text-violet-400">balance</span>}
                              {h === mapping.description && <span className="ml-1 text-amber-400">desc</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="border-t border-slate-800/60 text-slate-300">
                            {parsed.headers.map((h) => (
                              <td key={h} className="px-2 py-1 align-top">
                                {row[h]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {parsed.rows.length} rows detected · showing first {previewRows.length}.
                  </p>
                </div>
              </>
            )}
            {parsed && parsed.headers.length === 0 && (
              <p className="rounded-lg bg-amber-900/30 p-3 text-sm text-amber-200">
                No headers detected. Try adjusting the delimiter or encoding.
              </p>
            )}
          </>
        )}
        {error && <p className="rounded-lg bg-red-900/40 p-3 text-sm text-red-200">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!parsed || parsed.headers.length === 0}>
            Import {parsed ? `${parsed.rows.length} rows` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FileDrop({ onFile }: { onFile: (f: File) => void }) {
  return (
    <label
      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-10 text-center transition hover:border-cyan-400 hover:bg-slate-950/60"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10 text-slate-500">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
      </svg>
      <div className="text-sm text-slate-300">
        <span className="font-medium text-cyan-400">Click to choose</span> or drag a CSV file here
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
