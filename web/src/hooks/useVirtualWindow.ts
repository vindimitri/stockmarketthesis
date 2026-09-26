import { useEffect, useState, type RefObject } from "react";

/** Window-scroll virtualization for lists that live in page flow (mobile) or overflow parents. */
export function useVirtualWindow(
  count: number,
  rowHeight: number,
  hostRef: RefObject<HTMLElement | null>,
  overscan = 6,
): { start: number; end: number; offsetTop: number; totalHeight: number } {
  const totalHeight = Math.max(0, count * rowHeight);
  const [range, setRange] = useState({ start: 0, end: Math.min(count, overscan * 2) });

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const host = hostRef.current;
      if (!host || count <= 0) {
        setRange({ start: 0, end: 0 });
        return;
      }
      const rect = host.getBoundingClientRect();
      const viewH = globalThis.innerHeight || 800;
      const top = Math.max(0, -rect.top);
      const bottom = Math.min(totalHeight, top + viewH + Math.max(0, rect.top));
      const start = Math.max(0, Math.floor(top / rowHeight) - overscan);
      const end = Math.min(count, Math.ceil(bottom / rowHeight) + overscan);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    const onScroll = () => {
      if (raf) return;
      raf = globalThis.requestAnimationFrame(measure);
    };
    measure();
    globalThis.addEventListener("scroll", onScroll, { passive: true, capture: true });
    globalThis.addEventListener("resize", onScroll, { passive: true });
    const host = hostRef.current;
    const scrollParent = host?.closest(".desk-deriv-body");
    scrollParent?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (raf) globalThis.cancelAnimationFrame(raf);
      globalThis.removeEventListener("scroll", onScroll, true);
      globalThis.removeEventListener("resize", onScroll);
      scrollParent?.removeEventListener("scroll", onScroll);
    };
  }, [count, rowHeight, overscan, totalHeight, hostRef]);

  return {
    start: range.start,
    end: range.end,
    offsetTop: range.start * rowHeight,
    totalHeight,
  };
}
