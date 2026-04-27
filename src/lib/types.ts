import { z } from 'zod';

export type PresetId = 'sparkasse' | 'vr' | 'postbank' | 'commerzbank' | 'custom';

export const ColumnMappingSchema = z.object({
  date: z.string(),
  amount: z.string(),
  balance: z.string().optional(),
  description: z.string().optional(),
  counterparty: z.string().optional(),
});
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

export const PresetConfigSchema = z.object({
  id: z.union([
    z.literal('sparkasse'),
    z.literal('vr'),
    z.literal('postbank'),
    z.literal('commerzbank'),
    z.literal('custom'),
  ]),
  name: z.string(),
  delimiter: z.string(),
  encoding: z.string(),
  decimal: z.enum([',', '.']),
  dateFormat: z.string(),
  defaultMapping: ColumnMappingSchema,
  hasBalanceColumn: z.boolean(),
  notes: z.string().optional(),
});
export type PresetConfig = z.infer<typeof PresetConfigSchema>;

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  presetId: z.union([
    z.literal('sparkasse'),
    z.literal('vr'),
    z.literal('postbank'),
    z.literal('commerzbank'),
    z.literal('custom'),
  ]),
  mapping: ColumnMappingSchema,
  delimiter: z.string(),
  encoding: z.string(),
  decimal: z.enum([',', '.']),
  dateFormat: z.string(),
  startingBalance: z.number().optional(),
  currency: z.literal('EUR'),
  createdAt: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  date: z.string(), // ISO yyyy-MM-dd
  amount: z.number(),
  balance: z.number(),
  description: z.string().optional(),
  counterparty: z.string().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export type Timespan = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export type PrognosisMethod = 'linear' | 'avgNet';
export type ChartView = 'balance' | 'monthly' | 'counterparty';

export const SettingsSchema = z.object({
  defaultTimespan: z.enum(['1M', '3M', '6M', '1Y', 'ALL']).default('6M'),
  prognosisMethod: z.enum(['linear', 'avgNet']).default('linear'),
  prognosisHorizonMonths: z.number().int().min(0).max(24).default(6),
  showCombined: z.boolean().default(true),
});
export type Settings = z.infer<typeof SettingsSchema>;

export type DailyPoint = { date: string; balance: number };
export type SeriesPoint = { date: string; [accountId: string]: number | string };
