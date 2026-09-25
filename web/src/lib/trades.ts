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

type ContractRow = { date: string; n: number; volume: number };

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

export function summarizeTrades(rows: TradeRow[]): { open: number; close: number } | null {
  if (!rows.length) return null;
  return { open: rows[0].price, close: rows[rows.length - 1].price };
}

export function contractLabel(contractDate: string): string {
  if (contractDate === "all") return "FDAX";
  const parsed = parseYmd(contractDate);
  if (!parsed) return "FDAX";
  return `FDAX ${MONTH_SHORT[parsed.month]} ${String(parsed.year).slice(2)}`;
}
