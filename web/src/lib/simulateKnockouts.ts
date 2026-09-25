import type { TradeRow } from "../api";
import { berlinChartRange, berlinWallSec } from "../format";
import { toSessionPoints } from "../linePoints";

type KnockoutSide = "long" | "short";

export type KnockoutFill = {
  side: KnockoutSide;
  buyTime: number;
  sellTime: number | null;
  entry: number;
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

const START_CAPITAL = 50;

const BUCKET = 30;
const TRIGGER = 8;
const BASE_POINTS = 4;
const BASE_BAND = 2;
const LEVERAGE = 100;
const BUY_IN = 1;
const TARGET_PRICE = BUY_IN * 1.25;
const STOP_PRICE = BUY_IN * 0.8;

function knockoutPrice(side: KnockoutSide, entry: number, spot: number): number {
  const move = side === "long" ? (spot - entry) / entry : (entry - spot) / entry;
  return Math.max(0, BUY_IN * (1 + LEVERAGE * move));
}

function sideFor(k: number, n: number): KnockoutSide | null {
  if (k >= n + TRIGGER) return "short";
  if (k <= n - TRIGGER) return "long";
  return null;
}

export function simulateKnockout(trades: TradeRow[], ymd: string): KnockoutFill | null {
  if (!trades.length || !ymd) return null;
  const range = berlinChartRange(ymd, "1718");
  if (!range) return null;
  const searchUntil = berlinWallSec(ymd, 17, 40);
  const forceExit = berlinWallSec(ymd, 17, 55);
  const grid = toSessionPoints(trades, BUCKET, range.from, range.to);
  const start = grid.findIndex((point) => point.value != null);
  if (start < 0) return null;
  const n = grid[start].value;
  if (n == null) return null;

  let fill: { side: KnockoutSide; buyTime: number; entry: number } | null = null;
  for (let i = start + 1; i < grid.length; i += 1) {
    const point = grid[i];
    if (point.time > searchUntil) break;
    if (point.value == null) continue;
    const side = sideFor(point.value, n);
    if (!side) continue;
    const base = grid.slice(i + 1, i + 1 + BASE_POINTS);
    const ok =
      base.length === BASE_POINTS &&
      base.every((bar) => bar.value != null && Math.abs(bar.value - point.value!) <= BASE_BAND);
    if (!ok) continue;
    const last = base[BASE_POINTS - 1];
    if (last.value == null) continue;
    fill = { side, buyTime: last.time, entry: last.value };
    break;
  }
  if (!fill) return null;

  const mark = (spot: number) => knockoutPrice(fill.side, fill.entry, spot);
  const done = (price: number, open: boolean, sellTime: number | null): KnockoutFill => ({
    ...fill,
    sellTime,
    price,
    pnl: price - BUY_IN,
    open,
  });

  for (const trade of trades) {
    const t = Math.floor(Date.parse(trade.event_time) / 1000);
    if (t <= fill.buyTime || t >= forceExit) continue;
    const price = mark(trade.price);
    if (price >= TARGET_PRICE) return done(TARGET_PRICE, false, t);
    if (price <= STOP_PRICE) return done(STOP_PRICE, false, t);
  }

  let last: TradeRow | undefined;
  for (let i = trades.length - 1; i >= 0; i -= 1) {
    const t = Math.floor(Date.parse(trades[i].event_time) / 1000);
    if (t > forceExit) continue;
    if (t <= fill.buyTime) break;
    last = trades[i];
    break;
  }
  if (!last) return done(BUY_IN, true, null);
  const lastT = Math.floor(Date.parse(last.event_time) / 1000);
  const price = mark(last.price);
  if (Math.floor(Date.now() / 1000) >= forceExit) return done(price, false, Math.max(lastT, forceExit));
  return done(price, true, null);
}

export function markLiveFill(fill: KnockoutFill, spot: number, nowSec: number): KnockoutFill {
  if (!fill.open || fill.entry <= 0) return fill;
  const price = knockoutPrice(fill.side, fill.entry, spot);
  if (price >= TARGET_PRICE) {
    return { ...fill, price: TARGET_PRICE, pnl: TARGET_PRICE - BUY_IN, open: false, sellTime: nowSec };
  }
  if (price <= STOP_PRICE) {
    return { ...fill, price: STOP_PRICE, pnl: STOP_PRICE - BUY_IN, open: false, sellTime: nowSec };
  }
  return { ...fill, price, pnl: price - BUY_IN, open: true, sellTime: null };
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
