import { useEffect, useState } from "react";

/** False while the user is actively scrolling; true again shortly after they stop. */
export function useScrollIdle(settleMs = 160): boolean {
  const [idle, setIdle] = useState(true);

  useEffect(() => {
    let timer = 0;
    let scrolling = false;
    const onScroll = () => {
      if (!scrolling) {
        scrolling = true;
        setIdle(false);
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scrolling = false;
        setIdle(true);
      }, settleMs);
    };
    // Scroll only — never touchmove (that fights native scrolling / causes jank).
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    const shell = document.querySelector(".desk-shell");
    shell?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll, true);
      shell?.removeEventListener("scroll", onScroll);
    };
  }, [settleMs]);

  return idle;
}
