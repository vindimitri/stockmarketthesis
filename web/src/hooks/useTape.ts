import { useEffect, useMemo, useRef, useState } from "react";
import type { TradeRow } from "../api";
import { countDue, DEFAULT_TAPE_DELAY_MS } from "../tape";

const TAPE_TICK_MS = 250;

export function useTape(
  trades: TradeRow[],
  enabled: boolean,
  resetKey: string,
  delayMs = DEFAULT_TAPE_DELAY_MS,
) {
  const tradesRef = useRef(trades);
  tradesRef.current = trades;
  const countRef = useRef(0);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      countRef.current = trades.length;
      setRevealedCount(trades.length);
      return;
    }
    const due = countDue(trades, Date.now() - delayMs);
    countRef.current = due;
    setRevealedCount(due);
  }, [enabled, delayMs, resetKey, trades]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    const reveal = () => {
      if (!alive || document.hidden) return;
      const due = countDue(tradesRef.current, Date.now() - delayMs);
      if (due !== countRef.current) {
        countRef.current = due;
        setRevealedCount(due);
      }
    };

    const timer = window.setInterval(reveal, TAPE_TICK_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [enabled, delayMs, resetKey]);

  return useMemo(
    () => (enabled ? trades.slice(0, revealedCount) : trades),
    [enabled, trades, revealedCount],
  );
}
