import { useEffect } from "react";

/**
 * Scroll-idle flag without React state.
 * Mid-scroll setState → full App/chart re-render is what made mobile scroll feel broken.
 */
let scrollIdle = true;
let settleTimer = 0;

export function getScrollIdle(): boolean {
  return scrollIdle;
}

/** Wire once from App — updates a module flag only, never re-renders. */
export function useScrollIdleBridge(settleMs = 160): void {
  useEffect(() => {
    const onScroll = () => {
      scrollIdle = false;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        scrollIdle = true;
      }, settleMs);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    const shell = document.querySelector(".desk-shell");
    shell?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll, true);
      shell?.removeEventListener("scroll", onScroll);
      scrollIdle = true;
    };
  }, [settleMs]);
}
