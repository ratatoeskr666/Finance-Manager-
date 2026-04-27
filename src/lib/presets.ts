import type { PresetConfig, PresetId } from './types';

export const PRESETS: Record<Exclude<PresetId, 'custom'>, PresetConfig> = {
  sparkasse: {
    id: 'sparkasse',
    name: 'Sparkasse',
    delimiter: ';',
    encoding: 'iso-8859-1',
    decimal: ',',
    dateFormat: 'dd.MM.yy',
    hasBalanceColumn: true,
    defaultMapping: {
      date: 'Buchungstag',
      amount: 'Betrag',
      balance: 'Saldo nach Buchung',
      description: 'Verwendungszweck',
      counterparty: 'Beguenstigter/Zahlungspflichtiger',
    },
    notes: 'Semicolon-delimited, ISO-8859-1 encoding, includes running balance column.',
  },
  vr: {
    id: 'vr',
    name: 'VR-Bank / Volksbank',
    delimiter: ';',
    encoding: 'utf-8',
    decimal: ',',
    dateFormat: 'dd.MM.yyyy',
    hasBalanceColumn: false,
    defaultMapping: {
      date: 'Buchungstag',
      amount: 'Umsatz',
      description: 'Verwendungszweck',
      counterparty: 'Zahler/Empfänger',
    },
    notes: 'Semicolon-delimited; balance is derived from a starting balance + amounts.',
  },
  postbank: {
    id: 'postbank',
    name: 'Postbank',
    delimiter: ';',
    encoding: 'utf-8',
    decimal: ',',
    dateFormat: 'dd.MM.yyyy',
    hasBalanceColumn: false,
    defaultMapping: {
      date: 'Buchungsdatum',
      amount: 'Betrag (€)',
      description: 'Verwendungszweck',
      counterparty: 'Auftraggeber/Empfänger',
    },
    notes: 'Limited to last ~100 days; balance is derived.',
  },
  commerzbank: {
    id: 'commerzbank',
    name: 'Commerzbank',
    delimiter: ';',
    encoding: 'utf-8',
    decimal: ',',
    dateFormat: 'dd.MM.yyyy',
    hasBalanceColumn: false,
    defaultMapping: {
      date: 'Buchungstag',
      amount: 'Betrag',
      description: 'Buchungstext',
      counterparty: 'Begünstigter/Auftraggeber',
    },
    notes: 'Some exports use commas instead of semicolons — switch the delimiter if parsing fails.',
  },
};

export const PRESET_LIST = Object.values(PRESETS);

export function getPreset(id: PresetId): PresetConfig | undefined {
  if (id === 'custom') return undefined;
  return PRESETS[id];
}
