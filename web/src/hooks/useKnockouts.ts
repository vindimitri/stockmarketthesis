import { useEffect, useMemo, useState } from "react";
import { api, type DayRow, type TradeRow } from "../api";
import { DEFAULT_CONTRACT } from "../desk";
import { berlinTodayYmd } from "../format";
import {
  applyBankroll,
  markLiveFill,
  simulateKnockout,
  type BankedKnockout,
  type KnockoutFill,
} from "../lib/simulateKnockouts";

export type KnockoutRow = KnockoutFill & { date: string };

export type NumberedKnockout = BankedKnockout<KnockoutRow> & {
  nr: number;
  title: string;
};

function preferContract(trades: TradeRow[]): TradeRow[] {
  const hit = trades.filter((trade) => trade.contract_date === DEFAULT_CONTRACT);
  return hit.length ? hit : trades;
}

async function loadWindow(ymd: string): Promise<TradeRow[]> {
  const res = await api.trades(ymd, "17:00", "18:00");
  return preferContract(res.trades);
}

function fillFor(ymd: string, trades: TradeRow[]): KnockoutRow | null {
  let fill = simulateKnockout(trades, ymd);
  if (!fill) return null;
  if (fill.open && trades.length) {
    fill = markLiveFill(fill, trades[trades.length - 1].price, Math.floor(Date.now() / 1000));
  }
  return { ...fill, date: ymd };
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

  useEffect(() => {
    if (!dayKey) {
      setRows([]);
      return;
    }
    const dates = dayKey.split("|").filter((ymd) => ymd !== today);
    let cancelled = false;
    (async () => {
      const next = (
        await Promise.all(
          dates.map(async (ymd) => {
            try {
              return fillFor(ymd, await loadWindow(ymd));
            } catch {
              return null;
            }
          }),
        )
      ).filter((row): row is KnockoutRow => row != null);
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [dayKey, today]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      if (document.hidden) return;
      try {
        const trades = await loadWindow(today);
        if (!cancelled) setTodayTrades(trades);
      } catch {
        /* keep last good tape */
      }
    };
    void pull();
    const timer = window.setInterval(pull, 2_000);
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

  const todayRow = useMemo(() => fillFor(today, todayTrades), [today, todayTrades]);

  return useMemo(() => {
    const merged = todayRow ? [...rows.filter((row) => row.date !== today), todayRow] : rows;
    return numberKnockouts(applyBankroll(merged));
  }, [rows, todayRow, today]);
}
