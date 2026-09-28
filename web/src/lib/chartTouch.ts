import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { isMobileUi } from "./media";

/**
 * Mobile crosshair scrub: the marker follows the finger.
 * Vertical page scroll always wins — never preventDefault, drop the crosshair once
 * the gesture is clearly a page scroll.
 */
export function attachTouchCrosshair(
  host: HTMLElement,
  chart: IChartApi,
  getSeries: () => ISeriesApi<SeriesType> | null,
): () => void {
  if (!isMobileUi()) return () => {};

  let startX = 0;
  let startY = 0;
  let active = false;
  let pageScrolling = false;

  const place = (clientX: number, clientY: number) => {
    const series = getSeries();
    if (!series) return;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const price = series.coordinateToPrice(y);
    const time = chart.timeScale().coordinateToTime(x) as Time | null;
    if (price == null || time == null) return;
    chart.setCrosshairPosition(price, time, series);
  };

  const clear = () => {
    chart.clearCrosshairPosition();
  };

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    active = true;
    pageScrolling = false;
    place(touch.clientX, touch.clientY);
  };

  const onMove = (event: TouchEvent) => {
    if (!active || pageScrolling || !event.touches.length) return;
    const touch = event.touches[0];
    const dx = Math.abs(touch.clientX - startX);
    const dy = Math.abs(touch.clientY - startY);
    // Vertical dominates → user is scrolling the page; yield completely.
    if (dy > 10 && dy >= dx) {
      pageScrolling = true;
      clear();
      return;
    }
    place(touch.clientX, touch.clientY);
  };

  const onEnd = () => {
    active = false;
    if (pageScrolling) clear();
    pageScrolling = false;
  };

  // All passive — never call preventDefault (page scroll must stay native).
  host.addEventListener("touchstart", onStart, { passive: true });
  host.addEventListener("touchmove", onMove, { passive: true });
  host.addEventListener("touchend", onEnd, { passive: true });
  host.addEventListener("touchcancel", onEnd, { passive: true });
  return () => {
    host.removeEventListener("touchstart", onStart);
    host.removeEventListener("touchmove", onMove);
    host.removeEventListener("touchend", onEnd);
    host.removeEventListener("touchcancel", onEnd);
  };
}
