import { get, set, del, keys } from 'idb-keyval';
import { z } from 'zod';
import {
  AccountSchema,
  SettingsSchema,
  TransactionSchema,
  type Account,
  type Settings,
  type Transaction,
} from './types';

const SCHEMA_VERSION = 1;
const KEYS = {
  schemaVersion: 'schemaVersion',
  accounts: 'accounts',
  settings: 'settings',
  transactionsPrefix: 'transactions:',
} as const;

const AccountsArraySchema = z.array(AccountSchema);
const TransactionsArraySchema = z.array(TransactionSchema);

export async function init(): Promise<void> {
  const v = await get<number>(KEYS.schemaVersion);
  if (v === undefined) {
    await set(KEYS.schemaVersion, SCHEMA_VERSION);
  }
  // Future migrations would dispatch on `v` here.
}

export async function loadAccounts(): Promise<Account[]> {
  const raw = await get(KEYS.accounts);
  if (!raw) return [];
  const parsed = AccountsArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function saveAccounts(accounts: Account[]): Promise<void> {
  await set(KEYS.accounts, accounts);
}

export async function loadTransactions(accountId: string): Promise<Transaction[]> {
  const raw = await get(KEYS.transactionsPrefix + accountId);
  if (!raw) return [];
  const parsed = TransactionsArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function saveTransactions(accountId: string, txs: Transaction[]): Promise<void> {
  await set(KEYS.transactionsPrefix + accountId, txs);
}

export async function deleteAccountData(accountId: string): Promise<void> {
  await del(KEYS.transactionsPrefix + accountId);
}

export async function loadSettings(): Promise<Settings> {
  const raw = await get(KEYS.settings);
  const parsed = SettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return SettingsSchema.parse({});
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set(KEYS.settings, settings);
}

export async function exportAll(): Promise<string> {
  const accounts = await loadAccounts();
  const txByAccount: Record<string, Transaction[]> = {};
  for (const a of accounts) txByAccount[a.id] = await loadTransactions(a.id);
  const settings = await loadSettings();
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, accounts, transactions: txByAccount, settings }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  const accounts = AccountsArraySchema.parse(parsed.accounts ?? []);
  const settings = SettingsSchema.parse(parsed.settings ?? {});
  const txByAccount = z.record(z.string(), TransactionsArraySchema).parse(parsed.transactions ?? {});
  await saveAccounts(accounts);
  await saveSettings(settings);
  for (const [id, txs] of Object.entries(txByAccount)) {
    await saveTransactions(id, txs);
  }
}

export async function listKeys(): Promise<string[]> {
  return (await keys()).map(String);
}
