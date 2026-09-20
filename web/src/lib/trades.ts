import type { TradeRow } from "../api";
import { parseYmd } from "../format";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export type ContractRow = { date: string; n: number; volume: number };

export type TradeStats = {
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
  vwap: number | null;
};

export function groupContracts(trades: TradeRow[]): ContractRow[] {
  const map = new Map<string, ContractRow>();
  for (const trade of trades) {
    const cur = map.get(trade.contract_date) ?? {
      date: trade.contract_date,
      n: 0,
      volume: 0,
    };
    cur.n += 1;
    cur.volume += trade.quantity;
    map.set(trade.contract_date, cur);
  }
  return [...map.values()].sort((a, b) => b.volume - a.volume);
}

export function summarizeTrades(rows: TradeRow[]): TradeStats | null {
  if (!rows.length) return null;
  let low = rows[0].price;
  let high = rows[0].price;
  let volume = 0;
  let notional = 0;
  for (const row of rows) {
    low = Math.min(low, row.price);
    high = Math.max(high, row.price);
    volume += row.quantity;
    notional += row.price * row.quantity;
  }
  return {
    open: rows[0].price,
    close: rows[rows.length - 1].price,
    low,
    high,
    volume,
    vwap: volume > 0 ? notional / volume : null,
  };
}

export function pageSlice<T>(rows: T[], page: number, pageSize: number, newestFirst: boolean): T[] {
  if (!newestFirst) return rows.slice(page * pageSize, page * pageSize + pageSize);
  const end = rows.length - page * pageSize;
  const start = Math.max(0, end - pageSize);
  if (end <= 0) return [];
  return rows.slice(start, end).reverse();
}

export function contractLabel(contractDate: string): string {
  if (contractDate === "all") return "FDAX";
  const parsed = parseYmd(contractDate);
  if (!parsed) return "FDAX";
  return `FDAX ${MONTH_SHORT[parsed.month]} ${String(parsed.year).slice(2)}`;
}
