import { useEffect, useState } from "react";

/** False while the user is actively scrolling; true again shortly after they stop. */
export function useScrollIdle(settleMs = 140): boolean {
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
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("scroll", onScroll, opts);
    window.addEventListener("touchmove", onScroll, { passive: true });
    const shell = document.querySelector(".desk-shell");
    shell?.addEventListener("scroll", onScroll, { passive: true });
    document.querySelectorAll(".desk-deriv-body").forEach((node) => {
      node.addEventListener("scroll", onScroll, { passive: true });
    });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("touchmove", onScroll);
      shell?.removeEventListener("scroll", onScroll);
      document.querySelectorAll(".desk-deriv-body").forEach((node) => {
        node.removeEventListener("scroll", onScroll);
      });
    };
  }, [settleMs]);

  return idle;
}
