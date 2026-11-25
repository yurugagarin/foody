import type { Attempt } from '../types';

export interface Stats {
  avg: number | null;
  count: number;
  rated: number;
  /** Time of the last cooking (ms), or null. */
  last: number | null;
  best: Attempt | null;
}

/** Imported attempts without a date get a createdAt below this: their time is unknown. */
export const UNKNOWN_TIME = 1e9;

/** When the attempt happened, or null if unknown. */
export function attemptTime(a: Attempt): number | null {
  if (a.tarih) {
    const t = Date.parse(a.tarih);
    if (!Number.isNaN(t)) return t;
  }
  return a.createdAt >= UNKNOWN_TIME ? a.createdAt : null;
}

/** Newest first; attempts with unknown dates keep their imported order at the end. */
export function sortAttempts(list: Attempt[]): Attempt[] {
  return list.slice().sort((a, b) => (attemptTime(b) ?? -1) - (attemptTime(a) ?? -1) || b.createdAt - a.createdAt);
}

export function stats(attempts: Attempt[]): Stats {
  const rated = attempts.filter((a) => typeof a.puan === 'number');
  const avg = rated.length ? rated.reduce((s, a) => s + (a.puan as number), 0) / rated.length : null;
  const times = attempts.map(attemptTime).filter((t): t is number => t != null);
  const last = times.length ? Math.max(...times) : null;
  const pinned = attempts.find((a) => a.enIyi);
  const top = rated.slice().sort((a, b) => (b.puan as number) - (a.puan as number) || (attemptTime(b) ?? 0) - (attemptTime(a) ?? 0))[0];
  return { avg, count: attempts.length, rated: rated.length, last, best: pinned ?? top ?? null };
}

const DAY = 86_400_000;

export function daysSince(t: number | null, now = Date.now()): number {
  if (t == null) return 30;
  return Math.max(0, Math.round((now - t) / DAY));
}

/**
 * How strongly a recipe should be suggested: loved recipes and ones not cooked
 * for a while come up more. Unrated recipes count as 7/10.
 */
export function weight(avg: number | null, days: number): number {
  const a = avg ?? 7;
  return Math.pow(Math.max(a - 5, 0.5), 2) * (1 + Math.min(days, 120) / 14);
}

/** Weighted random index, never `exclude` when there is another choice. */
export function weightedPick(weights: number[], exclude = -1, rand = Math.random): number {
  const idx = weights.map((_, i) => i).filter((i) => i !== exclude || weights.length === 1);
  const total = idx.reduce((s, i) => s + weights[i], 0);
  if (!idx.length) return -1;
  let r = rand() * total;
  for (const i of idx) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return idx[idx.length - 1];
}

export function agoText(t: number | null, now = Date.now(), count = 0): string {
  if (t == null) return count > 0 ? 'tarihi yok' : 'henüz yapılmadı';
  const d = daysSince(t, now);
  if (d === 0) return 'bugün';
  if (d === 1) return 'dün';
  if (d < 14) return `${d} gün önce`;
  if (d < 60) return `${Math.round(d / 7)} hafta önce`;
  return `${Math.round(d / 30)} ay önce`;
}
