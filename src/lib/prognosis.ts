import type { DailyPoint, PrognosisMethod } from './types';
import { addDays, addMonths, parseIso, toIsoDate } from './balances';

export type PrognosisPoint = DailyPoint & { upper?: number; lower?: number };

export type PrognosisInput = {
  series: DailyPoint[];
  method: PrognosisMethod;
  horizonMonths: number;
  /**
   * Trailing window used for the fit. Defaults to 6 months.
   */
  trainingMonths?: number;
};

/**
 * Build a future projection from the trailing N months of a daily balance series.
 * Returns daily points strictly AFTER the last point in `series`.
 */
export function projectFuture(input: PrognosisInput): PrognosisPoint[] {
  const { series, method, horizonMonths } = input;
  if (series.length === 0 || horizonMonths <= 0) return [];

  const last = series[series.length - 1];
  const trainingMonths = input.trainingMonths ?? 6;
  const windowStart = addMonths(parseIso(last.date), -trainingMonths);
  const train = series.filter((p) => parseIso(p.date) >= windowStart);
  if (train.length < 2) return [];

  const startDate = parseIso(train[0].date);
  const xs = train.map((p) => daysBetween(startDate, parseIso(p.date)));
  const ys = train.map((p) => p.balance);

  const future: PrognosisPoint[] = [];
  const projectionEnd = addMonths(parseIso(last.date), horizonMonths);

  if (method === 'linear') {
    const fit = linearRegression(xs, ys);
    const residuals = ys.map((y, i) => y - (fit.a * xs[i] + fit.b));
    const stddev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length - 1));
    let cursor = addDays(parseIso(last.date), 1);
    while (cursor <= projectionEnd) {
      const x = daysBetween(startDate, cursor);
      const y = fit.a * x + fit.b;
      future.push({ date: toIsoDate(cursor), balance: round2(y), upper: round2(y + stddev), lower: round2(y - stddev) });
      cursor = addDays(cursor, 1);
    }
    return future;
  }

  // avgNet: average daily change over the trailing window.
  const dailyDelta = (ys[ys.length - 1] - ys[0]) / Math.max(1, xs[xs.length - 1] - xs[0]);
  let cursor = addDays(parseIso(last.date), 1);
  let value = last.balance;
  while (cursor <= projectionEnd) {
    value = round2(value + dailyDelta);
    future.push({ date: toIsoDate(cursor), balance: value });
    cursor = addDays(cursor, 1);
  }
  return future;
}

export function linearRegression(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  if (n === 0) return { a: 0, b: 0 };
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const a = den === 0 ? 0 : num / den;
  const b = meanY - a * meanX;
  return { a, b };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
