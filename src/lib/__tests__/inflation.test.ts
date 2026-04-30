import { describe, expect, it } from 'vitest';
import { indexAt, parseEurostatJsonStat, toRealBalance, yoyPercent } from '../inflation';
import type { InflationSeries } from '../inflation';

const series: InflationSeries = {
  source: 'test',
  countryCode: 'DE',
  countryName: 'Germany',
  index: 'HICP',
  baseYear: 2015,
  unit: 'index 2015=100',
  fetchedAt: '2024-01-01T00:00:00.000Z',
  monthly: [
    { date: '2020-01-01', index: 100 },
    { date: '2020-06-01', index: 101 },
    { date: '2021-01-01', index: 102 },
    { date: '2022-01-01', index: 110 },
    { date: '2023-01-01', index: 120 },
  ],
};

describe('indexAt', () => {
  it('returns the value for an exact month match', () => {
    expect(indexAt(series, '2020-01-15')).toBe(100);
    expect(indexAt(series, '2022-01-31')).toBe(110);
  });
  it('carries the most recent observation forward', () => {
    expect(indexAt(series, '2020-03-10')).toBe(100);
    expect(indexAt(series, '2020-12-31')).toBe(101);
    expect(indexAt(series, '2024-08-15')).toBe(120);
  });
  it('returns null for dates before the first observation', () => {
    expect(indexAt(series, '2019-12-31')).toBeNull();
  });
});

describe('toRealBalance', () => {
  it('expresses balances in the anchor month purchasing power', () => {
    // Anchor at 2020-01-01 (index 100). At 2022-01-01 (index 110), 1100 EUR
    // nominal buys what 1000 EUR did in 2020-01.
    const real = toRealBalance(
      [
        { date: '2020-01-01', balance: 1000 },
        { date: '2022-01-01', balance: 1100 },
      ],
      series,
      '2020-01-01',
    );
    expect(real).toEqual([
      { date: '2020-01-01', balance: 1000 },
      { date: '2022-01-01', balance: 1000 },
    ]);
  });

  it('drops points before the first CPI observation', () => {
    const real = toRealBalance(
      [
        { date: '2019-01-01', balance: 500 },
        { date: '2020-01-01', balance: 1000 },
      ],
      series,
      '2020-01-01',
    );
    expect(real.map((r) => r.date)).toEqual(['2020-01-01']);
  });

  it('returns empty when anchor predates all data', () => {
    expect(toRealBalance([{ date: '2020-01-01', balance: 100 }], series, '2010-01-01')).toEqual([]);
  });
});

describe('yoyPercent', () => {
  it('computes year-over-year percent change', () => {
    // 2022-01 idx 110, 2021-01 idx 102 → ~7.84%.
    expect(yoyPercent(series, '2022-01-15')).toBeCloseTo(((110 - 102) / 102) * 100, 4);
  });
  it('returns null when the prior year is missing', () => {
    expect(yoyPercent(series, '2020-01-15')).toBeNull();
  });
});

describe('parseEurostatJsonStat', () => {
  it('extracts monthly observations from JSON-stat', () => {
    const json = {
      value: { '0': 100, '1': 102, '2': 105 },
      dimension: {
        time: {
          category: {
            index: { '2020M01': 0, '2020M02': 1, '2020M03': 2 },
            label: { '2020M01': '2020M01', '2020M02': '2020M02', '2020M03': '2020M03' },
          },
        },
      },
    };
    const out = parseEurostatJsonStat(json, 'DE', 'Germany');
    expect(out.countryCode).toBe('DE');
    expect(out.monthly).toHaveLength(3);
    expect(out.monthly[0]).toEqual({ date: '2020-01-01', index: 100 });
    expect(out.monthly[2]).toEqual({ date: '2020-03-01', index: 105 });
  });

  it('skips periods without a numeric value', () => {
    const json = {
      value: { '0': 100, '2': 110 }, // index 1 is missing
      dimension: {
        time: { category: { index: { '2020M01': 0, '2020M02': 1, '2020M03': 2 } } },
      },
    };
    const out = parseEurostatJsonStat(json, 'DE', 'Germany');
    expect(out.monthly).toHaveLength(2);
    expect(out.monthly.map((m) => m.date)).toEqual(['2020-01-01', '2020-03-01']);
  });

  it('throws when no observations are present', () => {
    expect(() => parseEurostatJsonStat({ value: {}, dimension: { time: { category: { index: {} } } } }, 'DE', 'Germany')).toThrow();
  });
});
