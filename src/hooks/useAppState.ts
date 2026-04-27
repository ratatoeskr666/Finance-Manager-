import { useCallback, useEffect, useState } from 'react';
import * as storage from '../lib/storage';
import type { Account, Settings, Transaction } from '../lib/types';
import { mergeTransactions } from '../lib/balances';

export type AppState = {
  loaded: boolean;
  accounts: Account[];
  txByAccount: Record<string, Transaction[]>;
  settings: Settings;
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
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await storage.init();
      const accounts = await storage.loadAccounts();
      const settings = await storage.loadSettings();
      const txByAccount: Record<string, Transaction[]> = {};
      for (const a of accounts) {
        txByAccount[a.id] = await storage.loadTransactions(a.id);
      }
      if (!cancelled) setState({ loaded: true, accounts, txByAccount, settings });
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
      const { [accountId]: _, ...rest } = prev.txByAccount;
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

  return {
    state,
    upsertAccount,
    removeAccount,
    addTransactions,
    replaceTransactions,
    updateSettings,
  };
}
