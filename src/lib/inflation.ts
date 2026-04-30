import { z } from 'zod';
import { HICP_DE_SNAPSHOT } from './inflation/snapshot-de';

export const InflationPointSchema = z.object({
  date: z.string(), // 'yyyy-MM-01'
  index: z.number(),
});
export type InflationPoint = z.infer<typeof InflationPointSchema>;

export const InflationSeriesSchema = z.object({
  source: z.string(),
  countryCode: z.string(),
  countryName: z.string(),
  index: z.string(), // e.g. 'HICP'
  baseYear: z.number(),
  unit: z.string(),
  fetchedAt: z.string(),
  monthly: z.array(InflationPointSchema),
});
export type InflationSeries = z.infer<typeof InflationSeriesSchema>;

export const InflationModeSchema = z.enum(['real', 'index']);
export type InflationMode = z.infer<typeof InflationModeSchema>;

export const InflationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mode: InflationModeSchema.default('real'),
  countryCode: z.string().default('DE'),
  /** Override the Eurostat URL used by Refresh. */
  customUrl: z.string().optional(),
  /**
   * Anchor date (yyyy-MM-01) for the real-value calculation. When undefined,
   * the chart uses the first balance date in the visible window.
   */
  anchorDate: z.string().optional(),
});
export type InflationSettings = z.infer<typeof InflationSettingsSchema>;

/** Built-in country choices in the dropdown, plus "Custom". */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'DE', name: 'Germany' },
  { code: 'EA', name: 'Euro area' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'EU', name: 'European Union' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
];

/**
 * Bundled snapshots that ship with the app so first-run is offline-friendly.
 * Other countries fall back to live-fetch on first use.
 */
export const BUNDLED_SERIES: Record<string, InflationSeries> = {
  DE: HICP_DE_SNAPSHOT,
};

/**
 * Default Eurostat HICP endpoint — JSON-stat (HICP all items, base 2015=100).
 * The geo dimension is appended at fetch time.
 */
export function defaultEurostatUrl(geo: string): string {
  return `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_midx?format=JSON&unit=I15&coicop=CP00&geo=${encodeURIComponent(geo)}&lang=en`;
}

/** Resolve initial display series, preferring cache over the bundled snapshot. */
export function pickSeries(
  cached: InflationSeries | undefined,
  countryCode: string,
): InflationSeries | null {
  if (cached && cached.countryCode === countryCode) return cached;
  return BUNDLED_SERIES[countryCode] ?? null;
}

/**
 * Lookup the CPI index value at a given ISO date by carrying the most recent
 * monthly observation forward. Returns null if the date precedes all data.
 */
export function indexAt(series: InflationSeries, isoDate: string): number | null {
  const month = `${isoDate.slice(0, 7)}-01`;
  let last: number | null = null;
  for (const p of series.monthly) {
    if (p.date > month) break;
    last = p.index;
  }
  return last;
}

/**
 * Convert a nominal balance series into a "real" (inflation-adjusted) one,
 * expressed in the purchasing power of `anchorIso`. Real = nominal × (CPI(anchor) / CPI(t)).
 * Points before the earliest CPI observation are dropped.
 */
export function toRealBalance(
  series: { date: string; balance: number }[],
  cpi: InflationSeries,
  anchorIso: string,
): { date: string; balance: number }[] {
  const anchor = indexAt(cpi, anchorIso);
  if (anchor === null) return [];
  const out: { date: string; balance: number }[] = [];
  for (const p of series) {
    const idx = indexAt(cpi, p.date);
    if (idx === null) continue;
    out.push({ date: p.date, balance: round2(p.balance * (anchor / idx)) });
  }
  return out;
}

/** Year-over-year inflation in percent at a given month, or null if unknown. */
export function yoyPercent(series: InflationSeries, isoDate: string): number | null {
  const idx = indexAt(series, isoDate);
  const idxPrev = indexAt(series, shiftMonth(isoDate, -12));
  if (idx === null || idxPrev === null || idxPrev === 0) return null;
  return ((idx - idxPrev) / idxPrev) * 100;
}

function shiftMonth(iso: string, deltaMonths: number): string {
  const [y, m] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/**
 * Parse Eurostat's JSON-stat response into our compact series format.
 * The endpoint structure is documented at
 * https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data — the
 * `value` object maps a flat index to the observation, and the `time`
 * dimension provides month-key → flat-index mappings.
 */
export function parseEurostatJsonStat(json: unknown, countryCode: string, countryName: string): InflationSeries {
  if (!json || typeof json !== 'object') throw new Error('Invalid Eurostat response');
  const j = json as {
    value?: Record<string, number>;
    dimension?: { time?: { category?: { index?: Record<string, number>; label?: Record<string, string> } } };
  };
  const value = j.value ?? {};
  const timeIndex = j.dimension?.time?.category?.index ?? {};
  const monthly: InflationPoint[] = [];
  for (const [period, flatIdx] of Object.entries(timeIndex)) {
    const v = value[String(flatIdx)];
    if (typeof v !== 'number') continue;
    const date = normalizeEurostatPeriod(period);
    if (!date) continue;
    monthly.push({ date, index: v });
  }
  if (monthly.length === 0) throw new Error('No monthly observations in Eurostat response');
  monthly.sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    source: 'eurostat-live',
    countryCode,
    countryName,
    index: 'HICP',
    baseYear: 2015,
    unit: 'index 2015=100',
    fetchedAt: new Date().toISOString(),
    monthly,
  };
}

/** Eurostat encodes monthly periods as "2024M01"; some endpoints use "2024-01". */
function normalizeEurostatPeriod(p: string): string | null {
  const m1 = /^(\d{4})M(\d{2})$/.exec(p);
  if (m1) return `${m1[1]}-${m1[2]}-01`;
  const m2 = /^(\d{4})-(\d{2})$/.exec(p);
  if (m2) return `${m2[1]}-${m2[2]}-01`;
  return null;
}

/**
 * Browser-side live fetch from Eurostat (or a custom URL). Caller is
 * responsible for catching network/parse errors and surfacing them.
 */
export async function fetchInflationSeries(
  countryCode: string,
  countryName: string,
  customUrl?: string,
): Promise<InflationSeries> {
  const url = customUrl?.trim() || defaultEurostatUrl(countryCode);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const json = await res.json();
  // If the URL returns our own format directly (custom user JSON), accept that.
  const direct = InflationSeriesSchema.safeParse(json);
  if (direct.success) return { ...direct.data, source: 'custom-url', fetchedAt: new Date().toISOString() };
  return parseEurostatJsonStat(json, countryCode, countryName);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
