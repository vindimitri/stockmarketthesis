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

/** Newest days first, then older chunks — avoids N parallel fetches on boot. */
const KO_FIRST_BATCH = 8;
const KO_CHUNK = 4;
const KO_CONCURRENCY = 2;

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

export function useKnockouts(days: DayRow[]) {
  const [rows, setRows] = useState<KnockoutRow[]>([]);
  const [todayTrades, setTodayTrades] = useState<TradeRow[]>([]);
  const dayKey = useMemo(() => days.map((day) => day.berlin_date).join("|"), [days]);
  const today = berlinTodayYmd();
  const genRef = useRef(0);

  useEffect(() => {
    if (!dayKey) {
      setRows([]);
      return;
    }
    const dates = dayKey.split("|").filter((ymd) => ymd !== today);
    const gen = ++genRef.current;
    let cancelled = false;

    (async () => {
      const first = dates.slice(0, KO_FIRST_BATCH);
      const rest = dates.slice(KO_FIRST_BATCH);
      const firstFills = (await mapPool(first, KO_CONCURRENCY, loadDayFills)).flat();
      if (cancelled || gen !== genRef.current) return;
      setRows(firstFills);

      for (let i = 0; i < rest.length; i += KO_CHUNK) {
        if (cancelled || gen !== genRef.current) return;
        const chunk = rest.slice(i, i + KO_CHUNK);
        const chunkFills = (await mapPool(chunk, KO_CONCURRENCY, loadDayFills)).flat();
        if (cancelled || gen !== genRef.current) return;
        if (chunkFills.length) {
          setRows((prev) => [...prev, ...chunkFills]);
        }
      }
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

  return useMemo(() => {
    const merged = [...rows.filter((row) => row.date !== today), ...todayRows];
    return numberKnockouts(applyBankroll(merged));
  }, [rows, todayRows, today]);
}
