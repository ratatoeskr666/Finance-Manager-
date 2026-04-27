import { describe, expect, it } from 'vitest';
import { linearRegression, projectFuture } from '../prognosis';
import type { DailyPoint } from '../types';

function linearSeries(start: string, days: number, slope: number, intercept: number): DailyPoint[] {
  const out: DailyPoint[] = [];
  const d = new Date(`${start}T00:00:00`);
  for (let i = 0; i < days; i++) {
    const dt = new Date(d);
    dt.setDate(d.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    out.push({ date: iso, balance: intercept + slope * i });
  }
  return out;
}

describe('linearRegression', () => {
  it('recovers the slope of a noiseless line', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [10, 13, 16, 19, 22];
    const fit = linearRegression(xs, ys);
    expect(fit.a).toBeCloseTo(3, 6);
    expect(fit.b).toBeCloseTo(10, 6);
  });
});

describe('projectFuture', () => {
  it('extrapolates a linear trend forward and adds a confidence band', () => {
    const series = linearSeries('2024-01-01', 180, 1, 1000); // 6 months of +1/day
    const future = projectFuture({ series, method: 'linear', horizonMonths: 1 });
    expect(future.length).toBeGreaterThan(28);
    // Slope should be ~1/day, so first projected day ≈ last + 1.
    const last = series[series.length - 1].balance;
    expect(future[0].balance).toBeCloseTo(last + 1, 1);
    // No noise → band collapses near the line.
    expect(Math.abs((future[0].upper ?? 0) - (future[0].lower ?? 0))).toBeLessThan(1);
  });

  it('avgNet projects a flat slope from last balance for a flat series', () => {
    const series: DailyPoint[] = Array.from({ length: 30 }, (_, i) => {
      const d = new Date('2024-01-01T00:00:00');
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().slice(0, 10), balance: 500 };
    });
    const future = projectFuture({ series, method: 'avgNet', horizonMonths: 1 });
    expect(future.length).toBeGreaterThan(28);
    // No change → projection stays at 500.
    expect(future[future.length - 1].balance).toBe(500);
  });

  it('returns empty when horizon is zero', () => {
    const series = linearSeries('2024-01-01', 30, 1, 100);
    expect(projectFuture({ series, method: 'linear', horizonMonths: 0 })).toEqual([]);
  });
});
