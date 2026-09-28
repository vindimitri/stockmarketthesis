import type { TradeRow } from "./api";
import { berlinChartRange, berlinWallSec } from "./format";
import { toSessionPoints, type LinePoint } from "./linePoints";

type KnockoutSide = "long" | "short";

export type KnockoutFill = {
  side: KnockoutSide;
  buyTime: number;
  sellTime: number | null;
  entry: number;
  exitSpot: number | null;
  barrier: number;
  price: number | null;
  pnl: number | null;
  open: boolean;
};

export type BankedKnockout<T extends { date: string; buyTime: number; price: number | null }> = T & {
  stake: number;
  changePct: number | null;
  changeEur: number | null;
  capitalAfter: number;
};

type Entry = {
  side: KnockoutSide;
  buyTime: number;
  entry: number;
  barrier: number;
};

export const START_CAPITAL = 5000;

/** Signal / entry grid (:00 / :30). */
const SIGNAL_BUCKET = 30;
/** Mark-to-market + exit grid — ignores second-level spikes. */
export const MARK_BUCKET = 10;
const TRIGGER = 8;
const BASE_POINTS = 4;
const BASE_BAND = 2;
const LEVERAGE = 100;
const BUY_IN = 1;
const TARGET_PRICE = BUY_IN * 1.25;

function barrierFor(side: KnockoutSide, entry: number): number {
  return side === "long" ? entry * (1 - 1 / LEVERAGE) : entry * (1 + 1 / LEVERAGE);
}

/** Points per € so that KO ≈ BUY_IN at entry with leverage LEVERAGE. */
function ratioFor(entry: number): number {
  return entry / (LEVERAGE * BUY_IN);
}

function knockoutPrice(side: KnockoutSide, entry: number, spot: number): number {
  const barrier = barrierFor(side, entry);
  const ratio = ratioFor(entry);
  if (side === "long") {
    if (spot <= barrier) return 0;
    return (spot - barrier) / ratio;
  }
  if (spot >= barrier) return 0;
  return (barrier - spot) / ratio;
}

function sideFor(k: number, n: number): KnockoutSide | null {
  if (k >= n + TRIGGER) return "short";
  if (k <= n - TRIGGER) return "long";
  return null;
}

/** Only fully closed 10s bars — skips the still-forming bucket. */
function markCutoff(forceExit: number, nowSec: number): number {
  if (nowSec >= forceExit) return forceExit;
  return Math.floor(nowSec / MARK_BUCKET) * MARK_BUCKET;
}

function findEntry(
  grid: { time: number; value?: number | null }[],
  start: number,
  n: number,
  searchUntil: number,
  afterSec: number,
): Entry | null {
  for (let i = start + 1; i < grid.length; i += 1) {
    const point = grid[i];
    if (point.time > searchUntil) break;
    if (point.time <= afterSec || point.value == null) continue;
    const side = sideFor(point.value, n);
    if (!side) continue;
    const base = grid.slice(i + 1, i + 1 + BASE_POINTS);
    const ok =
      base.length === BASE_POINTS &&
      base.every((bar) => bar.value != null && Math.abs(bar.value - point.value!) <= BASE_BAND);
    if (!ok) continue;
    const last = base[BASE_POINTS - 1];
    if (last.value == null || last.time <= afterSec) continue;
    return {
      side,
      buyTime: last.time,
      entry: last.value,
      barrier: barrierFor(side, last.value),
    };
  }
  return null;
}

function resolveExit(
  markGrid: LinePoint[],
  fill: Entry,
  forceExit: number,
  nowSec: number,
): KnockoutFill {
  const mark = (spot: number) => knockoutPrice(fill.side, fill.entry, spot);
  const done = (
    price: number,
    open: boolean,
    sellTime: number | null,
    exitSpot: number | null,
  ): KnockoutFill => ({
    ...fill,
    sellTime,
    exitSpot,
    price,
    pnl: price - BUY_IN,
    open,
  });
  const cutoff = markCutoff(forceExit, nowSec);

  for (const point of markGrid) {
    if (point.time <= fill.buyTime || point.time >= cutoff) continue;
    if (point.value == null) continue;
    const price = mark(point.value);
    if (price >= TARGET_PRICE) return done(TARGET_PRICE, false, point.time, point.value);
    if (price <= 0) return done(0, false, point.time, point.value);
  }

  let last: LinePoint | undefined;
  for (let i = markGrid.length - 1; i >= 0; i -= 1) {
    const point = markGrid[i];
    if (point.time >= cutoff || point.time <= fill.buyTime) continue;
    if (point.value == null) continue;
    last = point;
    break;
  }
  if (!last || last.value == null) return done(BUY_IN, true, null, null);
  const price = mark(last.value);
  if (price <= 0) return done(0, false, last.time, last.value);
  if (nowSec >= forceExit) return done(price, false, Math.max(last.time, forceExit), last.value);
  return done(price, true, null, null);
}

/** Last closed 10s bar spot for live KO marking. */
export function lastClosedMarkSpot(
  trades: TradeRow[],
  ymd: string,
  nowSec = Math.floor(Date.now() / 1000),
): { spot: number; time: number } | null {
  const range = berlinChartRange(ymd, "1718");
  if (!range) return null;
  const forceExit = berlinWallSec(ymd, 17, 55);
  const cutoff = markCutoff(forceExit ?? range.to, nowSec);
  const grid = toSessionPoints(trades, MARK_BUCKET, range.from, range.to);
  for (let i = grid.length - 1; i >= 0; i -= 1) {
    const point = grid[i];
    if (point.time >= cutoff) continue;
    if (point.value == null) continue;
    return { spot: point.value, time: point.time };
  }
  return null;
}

/** Zero or more sequential KOs: next buy only after previous sell. */
export function simulateKnockouts(trades: TradeRow[], ymd: string): KnockoutFill[] {
  if (!trades.length || !ymd) return [];
  const range = berlinChartRange(ymd, "1718");
  if (!range) return [];
  const searchUntil = berlinWallSec(ymd, 17, 40);
  const forceExit = berlinWallSec(ymd, 17, 55);
  const nowSec = Math.floor(Date.now() / 1000);
  const signalGrid = toSessionPoints(trades, SIGNAL_BUCKET, range.from, range.to);
  const markGrid = toSessionPoints(trades, MARK_BUCKET, range.from, range.to);
  const start = signalGrid.findIndex((point) => point.value != null);
  if (start < 0) return [];
  const n = signalGrid[start].value;
  if (n == null) return [];

  const fills: KnockoutFill[] = [];
  let afterSec = 0;
  while (true) {
    const entry = findEntry(signalGrid, start, n, searchUntil, afterSec);
    if (!entry) break;
    const fill = resolveExit(markGrid, entry, forceExit, nowSec);
    fills.push(fill);
    if (fill.open || fill.sellTime == null) break;
    afterSec = fill.sellTime;
  }
  return fills;
}

export function markLiveFill(fill: KnockoutFill, spot: number, barTime: number): KnockoutFill {
  if (!fill.open || fill.entry <= 0) return fill;
  const price = knockoutPrice(fill.side, fill.entry, spot);
  if (price >= TARGET_PRICE) {
    return {
      ...fill,
      price: TARGET_PRICE,
      pnl: TARGET_PRICE - BUY_IN,
      open: false,
      sellTime: barTime,
      exitSpot: spot,
    };
  }
  if (price <= 0) {
    return {
      ...fill,
      price: 0,
      pnl: 0 - BUY_IN,
      open: false,
      sellTime: barTime,
      exitSpot: spot,
    };
  }
  return { ...fill, price, pnl: price - BUY_IN, open: true, sellTime: null, exitSpot: null };
}

export function applyBankroll<T extends { date: string; buyTime: number; price: number | null }>(
  rows: T[],
): BankedKnockout<T>[] {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.buyTime - b.buyTime);
  let capital = START_CAPITAL;
  return sorted.map((row) => {
    if (capital <= 0) capital = START_CAPITAL;
    const stake = capital;
    if (row.price == null) {
      return { ...row, stake, changePct: null, changeEur: null, capitalAfter: capital };
    }
    const changePct = ((row.price - BUY_IN) / BUY_IN) * 100;
    const changeEur = stake * ((row.price - BUY_IN) / BUY_IN);
    capital = Math.max(0, stake + changeEur);
    return { ...row, stake, changePct, changeEur, capitalAfter: capital };
  });
}
