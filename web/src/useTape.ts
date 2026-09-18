import { useEffect, useRef, useState } from "react";
import type { TradeRow } from "./api";
import { countDue, DEFAULT_TAPE_DELAY_MS } from "./tape";

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
  const [tapeMs, setTapeMs] = useState(() => Date.now() - delayMs);

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
    let raf = 0;
    let clock = 0;
    let alive = true;

    const reveal = () => {
      if (!alive) return;
      if (!document.hidden) {
        const cutoff = Date.now() - delayMs;
        const due = countDue(tradesRef.current, cutoff);
        if (due !== countRef.current) {
          countRef.current = due;
          setRevealedCount(due);
        }
      }
      raf = requestAnimationFrame(reveal);
    };

    const tickClock = () => {
      if (!alive) return;
      setTapeMs(Date.now() - delayMs);
    };

    raf = requestAnimationFrame(reveal);
    tickClock();
    clock = window.setInterval(tickClock, 250);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.clearInterval(clock);
    };
  }, [enabled, delayMs, resetKey]);

  const lastMs = trades.length ? Date.parse(trades[trades.length - 1].event_time) : null;
  const waitingForIngest =
    enabled && lastMs != null && lastMs < Date.now() - delayMs - 90_000;

  return {
    revealed: enabled ? trades.slice(0, revealedCount) : trades,
    tapeMs,
    waitingForIngest,
  };
}
