import { describe, expect, it } from 'vitest';
import { parseAmount, parseDateString, parseRows } from '../parseRows';

describe('parseAmount', () => {
  it('parses German decimal with thousands separator', () => {
    expect(parseAmount('1.234,56', ',')).toBe(1234.56);
  });
  it('parses negative amounts', () => {
    expect(parseAmount('-12,34', ',')).toBe(-12.34);
  });
  it('parses trailing-minus exports', () => {
    expect(parseAmount('100,00-', ',')).toBe(-100);
  });
  it('strips currency symbols', () => {
    expect(parseAmount('€ 1.000,00', ',')).toBe(1000);
  });
  it('parses dot decimal', () => {
    expect(parseAmount('1,234.56', '.')).toBe(1234.56);
  });
  it('returns NaN for empty', () => {
    expect(Number.isNaN(parseAmount('', ','))).toBe(true);
  });
});

describe('parseDateString', () => {
  it('parses dd.MM.yyyy', () => {
    const d = parseDateString('15.03.2024', 'dd.MM.yyyy');
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
  });
  it('falls back to dd.MM.yy', () => {
    const d = parseDateString('15.03.24', 'dd.MM.yyyy');
    expect(d?.getFullYear()).toBe(2024);
  });
});

describe('parseRows', () => {
  it('produces transactions with iso dates and numeric amounts', () => {
    const rows = [
      { Buchungstag: '01.01.2024', Betrag: '10,00', Verwendungszweck: 'A' },
      { Buchungstag: '02.01.2024', Betrag: '-5,50', Verwendungszweck: 'B' },
    ];
    const { transactions, errors } = parseRows(rows, {
      mapping: { date: 'Buchungstag', amount: 'Betrag', description: 'Verwendungszweck' },
      decimal: ',',
      dateFormat: 'dd.MM.yyyy',
      accountId: 'acc1',
    });
    expect(errors).toHaveLength(0);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({ date: '2024-01-01', amount: 10, description: 'A', accountId: 'acc1' });
    expect(transactions[1]).toMatchObject({ date: '2024-01-02', amount: -5.5, description: 'B' });
  });

  it('reports row-level errors for unparseable values', () => {
    const rows = [{ d: 'not-a-date', a: 'oops' }];
    const { transactions, errors } = parseRows(rows, {
      mapping: { date: 'd', amount: 'a' },
      decimal: ',',
      dateFormat: 'dd.MM.yyyy',
      accountId: 'x',
    });
    expect(transactions).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});
