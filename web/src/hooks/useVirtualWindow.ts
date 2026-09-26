import { useEffect, useState, type RefObject } from "react";

function scrollParentOf(node: HTMLElement | null): HTMLElement | Window {
  let el: HTMLElement | null = node;
  while (el) {
    const style = getComputedStyle(el);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
}

/** Virtualize against the real scroll parent — avoid window capture thrash. */
export function useVirtualWindow(
  count: number,
  rowHeight: number,
  hostRef: RefObject<HTMLElement | null>,
  overscan = 6,
): { start: number; end: number; offsetTop: number; totalHeight: number } {
  const totalHeight = Math.max(0, count * rowHeight);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, overscan * 2) });

  useEffect(() => {
    if (count <= 0) {
      setRange({ start: 0, end: 0 });
      return;
    }

    let raf = 0;
    const host = hostRef.current;
    const scroller = scrollParentOf(host);

    const measure = () => {
      raf = 0;
      if (!host) {
        setRange({ start: 0, end: Math.min(count, overscan * 2) });
        return;
      }
      let top: number;
      let viewH: number;
      if (scroller === window) {
        const rect = host.getBoundingClientRect();
        viewH = window.innerHeight || 800;
        top = Math.max(0, -rect.top);
        const bottom = Math.min(totalHeight, top + viewH + Math.max(0, rect.top));
        const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
        const end = Math.min(count, Math.ceil(bottom / rowHeight) + overscan);
        setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
        return;
      }
      const box = scroller as HTMLElement;
      const hostTop = host.offsetTop;
      top = Math.max(0, box.scrollTop - hostTop);
      viewH = box.clientHeight;
      const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
      const end = Math.min(count, Math.ceil((top + viewH) / rowHeight) + overscan);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    if (scroller === window) {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else {
      (scroller as HTMLElement).addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      if (scroller === window) {
        window.removeEventListener("scroll", onScroll);
      } else {
        (scroller as HTMLElement).removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", onScroll);
    };
  }, [count, rowHeight, overscan, totalHeight, hostRef]);

  return {
    start: range.start,
    end: range.end,
    offsetTop: range.start * rowHeight,
    totalHeight,
  };
}
