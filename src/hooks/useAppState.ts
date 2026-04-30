import { useCallback, useEffect, useState } from 'react';
import * as storage from '../lib/storage';
import type {
  Account,
  Category,
  CategoryOverrides,
  CategoryRule,
  Settings,
  Transaction,
} from '../lib/types';
import { mergeTransactions } from '../lib/balances';

export type AppState = {
  loaded: boolean;
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  settings: Settings;
  categories: Category[];
  categoryRules: CategoryRule[];
  categoryOverrides: CategoryOverrides;
};

export function useAppState() {
  const [state, setState] = useState<AppState>({
    loaded: false,
    accounts: [],
    txByAccount: {},
    settings: {
      defaultTimespan: '6M',
      prognosisMethod: 'linear',
      prognosisHorizonMonths: 6,
      showCombined: true,
    },
    categories: [],
    categoryRules: [],
    categoryOverrides: {},
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await storage.init();
      const accounts = await storage.loadAccounts();
      const settings = await storage.loadSettings();
      const categories = await storage.loadCategories();
      const categoryRules = await storage.loadCategoryRules();
      const categoryOverrides = await storage.loadCategoryOverrides();
      const txByAccount: Record<string, Transaction[]> = {};
      for (const a of accounts) {
        txByAccount[a.id] = await storage.loadTransactions(a.id);
      }
      if (!cancelled)
        setState({ loaded: true, accounts, txByAccount, settings, categories, categoryRules, categoryOverrides });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsertAccount = useCallback(async (account: Account) => {
    setState((prev) => {
      const exists = prev.accounts.some((a) => a.id === account.id);
      const accounts = exists
        ? prev.accounts.map((a) => (a.id === account.id ? account : a))
        : [...prev.accounts, account];
      void storage.saveAccounts(accounts);
      return { ...prev, accounts };
    });
  }, []);

  const removeAccount = useCallback(async (accountId: string) => {
    setState((prev) => {
      const accounts = prev.accounts.filter((a) => a.id !== accountId);
      const { [accountId]: _removed, ...rest } = prev.txByAccount;
      void storage.saveAccounts(accounts);
      void storage.deleteAccountData(accountId);
      return { ...prev, accounts, txByAccount: rest };
    });
  }, []);

  const addTransactions = useCallback(async (accountId: string, incoming: Transaction[]) => {
    setState((prev) => {
      const existing = prev.txByAccount[accountId] ?? [];
      const merged = mergeTransactions(existing, incoming);
      void storage.saveTransactions(accountId, merged);
      return { ...prev, txByAccount: { ...prev.txByAccount, [accountId]: merged } };
    });
  }, []);

  const replaceTransactions = useCallback(async (accountId: string, txs: Transaction[]) => {
    setState((prev) => {
      void storage.saveTransactions(accountId, txs);
      return { ...prev, txByAccount: { ...prev.txByAccount, [accountId]: txs } };
    });
  }, []);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setState((prev) => {
      const settings = { ...prev.settings, ...patch };
      void storage.saveSettings(settings);
      return { ...prev, settings };
    });
  }, []);

  const upsertCategory = useCallback(async (cat: Category) => {
    setState((prev) => {
      const exists = prev.categories.some((c) => c.id === cat.id);
      const categories = exists
        ? prev.categories.map((c) => (c.id === cat.id ? cat : c))
        : [...prev.categories, cat];
      void storage.saveCategories(categories);
      return { ...prev, categories };
    });
  }, []);

  const removeCategory = useCallback(async (categoryId: string) => {
    setState((prev) => {
      const categories = prev.categories.filter((c) => c.id !== categoryId);
      const categoryRules = prev.categoryRules.filter((r) => r.categoryId !== categoryId);
      const categoryOverrides: CategoryOverrides = {};
      for (const [k, v] of Object.entries(prev.categoryOverrides)) {
        if (v !== categoryId) categoryOverrides[k] = v;
      }
      void storage.saveCategories(categories);
      void storage.saveCategoryRules(categoryRules);
      void storage.saveCategoryOverrides(categoryOverrides);
      return { ...prev, categories, categoryRules, categoryOverrides };
    });
  }, []);

  const setCategoryRules = useCallback(async (rules: CategoryRule[]) => {
    setState((prev) => {
      void storage.saveCategoryRules(rules);
      return { ...prev, categoryRules: rules };
    });
  }, []);

  const setCategoryOverride = useCallback(async (txKey: string, categoryId: string | null | undefined) => {
    setState((prev) => {
      const next = { ...prev.categoryOverrides };
      if (categoryId === undefined) {
        delete next[txKey];
      } else {
        next[txKey] = categoryId;
      }
      void storage.saveCategoryOverrides(next);
      return { ...prev, categoryOverrides: next };
    });
  }, []);

  const setCategoryOverridesBulk = useCallback(
    async (txKeys: string[], categoryId: string | null | undefined) => {
      setState((prev) => {
        const next = { ...prev.categoryOverrides };
        for (const k of txKeys) {
          if (categoryId === undefined) delete next[k];
          else next[k] = categoryId;
        }
        void storage.saveCategoryOverrides(next);
        return { ...prev, categoryOverrides: next };
      });
    },
    [],
  );

  return {
    state,
    upsertAccount,
    removeAccount,
    addTransactions,
    replaceTransactions,
    updateSettings,
    upsertCategory,
    removeCategory,
    setCategoryRules,
    setCategoryOverride,
    setCategoryOverridesBulk,
  };
}
