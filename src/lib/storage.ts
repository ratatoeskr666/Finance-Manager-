import { get, set, del, keys } from 'idb-keyval';
import { z } from 'zod';
import {
  AccountSchema,
  CategoryOverridesSchema,
  CategoryRuleSchema,
  CategorySchema,
  SettingsSchema,
  TransactionSchema,
  type Account,
  type Category,
  type CategoryOverrides,
  type CategoryRule,
  type Settings,
  type Transaction,
} from './types';
import { defaultCategories } from './categories';
import {
  InflationSeriesSchema,
  InflationSettingsSchema,
  type InflationSeries,
  type InflationSettings,
} from './inflation';

const SCHEMA_VERSION = 3;
const KEYS = {
  schemaVersion: 'schemaVersion',
  accounts: 'accounts',
  settings: 'settings',
  transactionsPrefix: 'transactions:',
  categories: 'categories',
  categoryRules: 'categoryRules',
  categoryOverrides: 'categoryOverrides',
  inflationSettings: 'inflationSettings',
  inflationSeriesPrefix: 'inflationSeries:',
} as const;

const AccountsArraySchema = z.array(AccountSchema);
const TransactionsArraySchema = z.array(TransactionSchema);
const CategoriesArraySchema = z.array(CategorySchema);
const CategoryRulesArraySchema = z.array(CategoryRuleSchema);

export async function init(): Promise<void> {
  const v = await get<number>(KEYS.schemaVersion);
  if (v === undefined) {
    await set(KEYS.schemaVersion, SCHEMA_VERSION);
  }
  // Seed default categories on first run.
  const cats = await get(KEYS.categories);
  if (cats === undefined) {
    await set(KEYS.categories, defaultCategories());
    await set(KEYS.categoryRules, []);
    await set(KEYS.categoryOverrides, {});
  }
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

export async function loadCategories(): Promise<Category[]> {
  const raw = await get(KEYS.categories);
  if (!raw) return [];
  const parsed = CategoriesArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function saveCategories(cats: Category[]): Promise<void> {
  await set(KEYS.categories, cats);
}

export async function loadCategoryRules(): Promise<CategoryRule[]> {
  const raw = await get(KEYS.categoryRules);
  if (!raw) return [];
  const parsed = CategoryRulesArraySchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function saveCategoryRules(rules: CategoryRule[]): Promise<void> {
  await set(KEYS.categoryRules, rules);
}

export async function loadCategoryOverrides(): Promise<CategoryOverrides> {
  const raw = await get(KEYS.categoryOverrides);
  if (!raw) return {};
  const parsed = CategoryOverridesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export async function saveCategoryOverrides(overrides: CategoryOverrides): Promise<void> {
  await set(KEYS.categoryOverrides, overrides);
}

export async function loadInflationSettings(): Promise<InflationSettings> {
  const raw = await get(KEYS.inflationSettings);
  const parsed = InflationSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return InflationSettingsSchema.parse({});
}

export async function saveInflationSettings(settings: InflationSettings): Promise<void> {
  await set(KEYS.inflationSettings, settings);
}

export async function loadInflationSeries(countryCode: string): Promise<InflationSeries | undefined> {
  const raw = await get(KEYS.inflationSeriesPrefix + countryCode);
  if (!raw) return undefined;
  const parsed = InflationSeriesSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function saveInflationSeries(series: InflationSeries): Promise<void> {
  await set(KEYS.inflationSeriesPrefix + series.countryCode, series);
}

export async function exportAll(): Promise<string> {
  const accounts = await loadAccounts();
  const txByAccount: Record<string, Transaction[]> = {};
  for (const a of accounts) txByAccount[a.id] = await loadTransactions(a.id);
  const settings = await loadSettings();
  const categories = await loadCategories();
  const categoryRules = await loadCategoryRules();
  const categoryOverrides = await loadCategoryOverrides();
  const inflationSettings = await loadInflationSettings();
  return JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      accounts,
      transactions: txByAccount,
      settings,
      categories,
      categoryRules,
      categoryOverrides,
      inflationSettings,
    },
    null,
    2,
  );
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json);
  const accounts = AccountsArraySchema.parse(parsed.accounts ?? []);
  const settings = SettingsSchema.parse(parsed.settings ?? {});
  const txByAccount = z.record(z.string(), TransactionsArraySchema).parse(parsed.transactions ?? {});
  const categories = CategoriesArraySchema.parse(parsed.categories ?? []);
  const categoryRules = CategoryRulesArraySchema.parse(parsed.categoryRules ?? []);
  const categoryOverrides = CategoryOverridesSchema.parse(parsed.categoryOverrides ?? {});
  const inflationSettings = InflationSettingsSchema.parse(parsed.inflationSettings ?? {});
  await saveAccounts(accounts);
  await saveSettings(settings);
  for (const [id, txs] of Object.entries(txByAccount)) {
    await saveTransactions(id, txs);
  }
  await saveCategories(categories);
  await saveCategoryRules(categoryRules);
  await saveCategoryOverrides(categoryOverrides);
  await saveInflationSettings(inflationSettings);
}

export async function listKeys(): Promise<string[]> {
  return (await keys()).map(String);
}
