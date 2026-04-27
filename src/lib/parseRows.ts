import { parse as parseDate, isValid } from 'date-fns';
import type { CsvRow } from './csv';
import type { ColumnMapping, Transaction } from './types';

export type ParseRowsOptions = {
  mapping: ColumnMapping;
  decimal: ',' | '.';
  dateFormat: string;
  accountId: string;
};

export type ParseRowsResult = {
  transactions: Omit<Transaction, 'balance'>[];
  errors: { row: number; reason: string; raw: CsvRow }[];
};

export function parseAmount(raw: string, decimal: ',' | '.'): number {
  if (!raw) return NaN;
  let s = raw.trim().replace(/\s/g, '').replace(/['"]/g, '');
  // Strip currency symbols.
  s = s.replace(/[€$£]/g, '');
  // Trailing minus (some exports do "100,00-").
  let sign = 1;
  if (s.endsWith('-')) {
    sign = -1;
    s = s.slice(0, -1);
  } else if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1);
  }
  if (decimal === ',') {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * sign : NaN;
}

export function parseDateString(raw: string, format: string): Date | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Try the configured format first, then common German variants, then ISO.
  // We sanity-check the year: date-fns parses '15.03.24' against 'dd.MM.yyyy'
  // as year=24, which we treat as a miss so the dd.MM.yy fallback can run.
  const tryFormats = [format, 'dd.MM.yyyy', 'dd.MM.yy', 'yyyy-MM-dd'];
  for (const f of tryFormats) {
    const d = parseDate(trimmed, f, new Date());
    if (isValid(d) && d.getFullYear() >= 1900) return d;
  }
  // ISO fallback.
  const d = new Date(trimmed);
  if (isValid(d)) return d;
  return null;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowId(accountId: string, date: string, amount: number, description: string | undefined, index: number) {
  return `${accountId}:${date}:${amount.toFixed(2)}:${(description ?? '').slice(0, 64)}:${index}`;
}

export function parseRows(rows: CsvRow[], opts: ParseRowsOptions): ParseRowsResult {
  const { mapping, decimal, dateFormat, accountId } = opts;
  const transactions: Omit<Transaction, 'balance'>[] = [];
  const errors: { row: number; reason: string; raw: CsvRow }[] = [];

  rows.forEach((row, i) => {
    const dateRaw = row[mapping.date];
    const amountRaw = row[mapping.amount];
    if (dateRaw === undefined || amountRaw === undefined) {
      errors.push({ row: i, reason: 'Missing mapped column', raw: row });
      return;
    }
    const d = parseDateString(dateRaw, dateFormat);
    if (!d) {
      errors.push({ row: i, reason: `Unparseable date: "${dateRaw}"`, raw: row });
      return;
    }
    const amount = parseAmount(amountRaw, decimal);
    if (Number.isNaN(amount)) {
      errors.push({ row: i, reason: `Unparseable amount: "${amountRaw}"`, raw: row });
      return;
    }
    const description = mapping.description ? row[mapping.description] : undefined;
    const counterparty = mapping.counterparty ? row[mapping.counterparty] : undefined;
    const date = toIsoDate(d);
    transactions.push({
      id: rowId(accountId, date, amount, description, i),
      accountId,
      date,
      amount,
      description: description?.trim() || undefined,
      counterparty: counterparty?.trim() || undefined,
    });
  });

  return { transactions, errors };
}

/**
 * If a balance column was mapped, parse it and attach to each transaction.
 * Returns transactions that already include `balance`.
 */
export function attachBalances(
  rows: CsvRow[],
  parsed: Omit<Transaction, 'balance'>[],
  mapping: ColumnMapping,
  decimal: ',' | '.',
): Transaction[] | null {
  if (!mapping.balance) return null;
  const out: Transaction[] = [];
  let pi = 0;
  for (let i = 0; i < rows.length && pi < parsed.length; i++) {
    const t = parsed[pi];
    const idx = Number(t.id.split(':').pop());
    if (idx !== i) continue;
    const balRaw = rows[i][mapping.balance];
    const balance = parseAmount(balRaw ?? '', decimal);
    if (Number.isNaN(balance)) return null;
    out.push({ ...t, balance });
    pi++;
  }
  return out.length === parsed.length ? out : null;
}
