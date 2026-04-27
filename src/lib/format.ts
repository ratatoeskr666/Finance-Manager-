const eurFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

const eurCompactFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
const monthFormatter = new Intl.DateTimeFormat('de-DE', { year: 'numeric', month: 'short' });

export function formatEur(n: number, compact = false): string {
  return compact ? eurCompactFormatter.format(n) : eurFormatter.format(n);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dateFormatter.format(new Date(y, m - 1, d));
}

export function formatMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return monthFormatter.format(new Date(y, m - 1, d));
}

const PALETTE = [
  '#22d3ee', // cyan-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#34d399', // emerald-400
  '#fbbf24', // amber-400
  '#f87171', // red-400
  '#60a5fa', // blue-400
  '#fb923c', // orange-400
];

export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
