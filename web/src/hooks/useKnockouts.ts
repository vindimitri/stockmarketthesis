import { useEffect, useMemo, useRef, useState } from "react";
import { api, type DayRow, type TradeRow } from "../lib/api";
import { DEFAULT_CONTRACT } from "../lib/desk";
import { berlinTodayYmd } from "../lib/format";
import {
  applyBankroll,
  lastClosedMarkSpot,
  markLiveFill,
  MARK_BUCKET,
  simulateKnockouts,
  type BankedKnockout,
  type KnockoutFill,
} from "../lib/simulateKnockouts";
import { getScrollIdle } from "./useScrollIdle";

export type KnockoutRow = KnockoutFill & { date: string };

export type NumberedKnockout = BankedKnockout<KnockoutRow> & {
  nr: number;
  title: string;
};

/** Parallel fetch — we gate UI on full history, so chunking only adds wait. */
const KO_CONCURRENCY = 8;

function preferContract(trades: TradeRow[]): TradeRow[] {
  const hit = trades.filter((trade) => trade.contract_date === DEFAULT_CONTRACT);
  return hit.length ? hit : trades;
}

async function loadWindow(ymd: string): Promise<TradeRow[]> {
  const res = await api.trades(ymd, "17:00", "18:00");
  return preferContract(res.trades);
}

function fillsFor(ymd: string, trades: TradeRow[]): KnockoutRow[] {
  const fills = simulateKnockouts(trades, ymd);
  if (!fills.length) return [];
  const closed = lastClosedMarkSpot(trades, ymd);
  return fills.map((fill) => {
    let next = fill;
    if (next.open && closed) {
      next = markLiveFill(next, closed.spot, closed.time);
    }
    return { ...next, date: ymd };
  });
}

async function loadDayFills(ymd: string): Promise<KnockoutRow[]> {
  try {
    return fillsFor(ymd, await loadWindow(ymd));
  } catch {
    return [];
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

function numberKnockouts(rows: BankedKnockout<KnockoutRow>[]): NumberedKnockout[] {
  let longNr = 0;
  let shortNr = 0;
  return rows.map((row) => {
    const nr = row.side === "long" ? (longNr += 1) : (shortNr += 1);
    return {
      ...row,
      nr,
      title: `${row.side === "long" ? "Long" : "Short"} ${nr}`,
    };
  });
}

/**
 * History loads in chunks; today polls fast. Bankroll compounds over ALL days,
 * so capital is withheld until historyReady — otherwise reload flashes START_CAPITAL
 * applied only to today's open fill.
 */
export function useKnockouts(days: DayRow[]): {
  rows: NumberedKnockout[];
  historyReady: boolean;
} {
  const [rows, setRows] = useState<KnockoutRow[]>([]);
  const [todayTrades, setTodayTrades] = useState<TradeRow[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const dayKey = useMemo(() => days.map((day) => day.berlin_date).join("|"), [days]);
  const today = berlinTodayYmd();
  const genRef = useRef(0);

  useEffect(() => {
    if (!dayKey) {
      setRows([]);
      setHistoryReady(false);
      return;
    }
    const dates = dayKey.split("|").filter((ymd) => ymd !== today);
    const gen = ++genRef.current;
    let cancelled = false;
    setHistoryReady(false);

    (async () => {
      if (!dates.length) {
        if (cancelled || gen !== genRef.current) return;
        setRows([]);
        setHistoryReady(true);
        return;
      }

      const fills = (await mapPool(dates, KO_CONCURRENCY, loadDayFills)).flat();
      if (cancelled || gen !== genRef.current) return;
      setRows(fills);
      setHistoryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [dayKey, today]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (document.hidden || !getScrollIdle()) return;
      try {
        const trades = await loadWindow(today);
        if (!cancelled) setTodayTrades(trades);
      } catch {
        /* keep last good tape */
      }
    };
    void pull();
    const timer = window.setInterval(pull, MARK_BUCKET * 1000);
    const onVis = () => {
      if (!document.hidden) void pull();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [today]);

  const todayRows = useMemo(() => fillsFor(today, todayTrades), [today, todayTrades]);

  const numbered = useMemo(() => {
    const merged = [...rows.filter((row) => row.date !== today), ...todayRows];
    return numberKnockouts(applyBankroll(merged));
  }, [rows, todayRows, today]);

  return { rows: numbered, historyReady };
}
