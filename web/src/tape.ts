import type { TradeRow } from "./api";

export const DEFAULT_TAPE_DELAY_MS = 15 * 60 * 1000;

export function countDue(trades: { event_time: string }[], cutoffMs: number): number {
  let lo = 0;
  let hi = trades.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Date.parse(trades[mid].event_time) <= cutoffMs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function mergeTrades(existing: TradeRow[], incoming: TradeRow[]): TradeRow[] {
  if (!incoming.length) return existing;
  const seen = new Set(existing.map((row) => row.external_id));
  const extra = incoming.filter((row) => !seen.has(row.external_id));
  if (!extra.length) return existing;
  return [...existing, ...extra].sort((a, b) => {
    if (a.event_time < b.event_time) return -1;
    if (a.event_time > b.event_time) return 1;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}
