import { useEffect, useRef, useState } from "react";
import { api, type DayRow, type TradeRow } from "../api";
import { berlinTodayYmd } from "../format";
import { DEFAULT_TAPE_DELAY_MS, mergeTrades } from "../tape";
import { useTape } from "./useTape";

export function useDeskData() {
  const [days, setDays] = useState<DayRow[]>([]);
  const [date, setDate] = useState("");
  const [tapeDelaySeconds, setTapeDelaySeconds] = useState<number | undefined>();
  const [ingestActive, setIngestActive] = useState(false);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tradesRef = useRef<TradeRow[]>([]);
  tradesRef.current = trades;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const [healthRes, dayRows] = await Promise.all([api.health(), api.days()]);
          if (cancelled) return;
          setTapeDelaySeconds(healthRes.tape_delay_seconds);
          setIngestActive(Boolean(healthRes.ingest_active));
          setDays(dayRows);
          const nextDate = dayRows[0]?.berlin_date || "";
          setDate((prev) => prev || nextDate);
          setError(null);
          if (!nextDate) setLoading(false);
          return;
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => window.setTimeout(resolve, 750));
        }
      }
      if (!cancelled) {
        setLoading(false);
        setError(lastError instanceof Error ? lastError.message : String(lastError));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const tradeRes = await api.trades(date, "00:00", "24:00");
        if (cancelled) return;
        setTrades(tradeRes.trades);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const live = Boolean(date) && date === berlinTodayYmd();
  const delayMs = (tapeDelaySeconds ?? DEFAULT_TAPE_DELAY_MS / 1000) * 1000;
  const taped = useTape(trades, live, date, delayMs);

  useEffect(() => {
    if (!live || !date) return;
    let cancelled = false;
    const poll = async () => {
      if (document.hidden) return;
      const last = tradesRef.current.at(-1);
      try {
        const [delta, healthRes, dayRows] = await Promise.all([
          api.trades(date, "00:00", "24:00", last?.event_time, last?.id ?? 0),
          api.health(),
          api.days(),
        ]);
        if (cancelled) return;
        if (delta.trades.length) {
          setTrades((prev) => mergeTrades(prev, delta.trades));
        }
        setTapeDelaySeconds(healthRes.tape_delay_seconds);
        setIngestActive(Boolean(healthRes.ingest_active));
        setDays(dayRows);
      } catch {
        /* keep the last good tape */
      }
    };
    const timer = window.setInterval(poll, 20_000);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [live, date]);

  useEffect(() => {
    let cancelled = false;
    const pull = async () => {
      try {
        const healthRes = await api.health();
        if (cancelled) return;
        setTapeDelaySeconds(healthRes.tape_delay_seconds);
        setIngestActive(Boolean(healthRes.ingest_active));
      } catch {
        if (!cancelled) setIngestActive(false);
      }
    };
    const timer = window.setInterval(pull, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return {
    days,
    date,
    setDate,
    trades,
    loading,
    error,
    live,
    ingestActive,
    taped,
  };
}
