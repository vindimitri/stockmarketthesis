import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { isMobileUi } from "../media";

/**
 * Mobile: tap-only crosshair, zero preventDefault — native scroll stays butter-smooth.
 * Desktop: no-op (mouse hover already drives the crosshair).
 */
export function attachTouchCrosshair(
  host: HTMLElement,
  chart: IChartApi,
  getSeries: () => ISeriesApi<SeriesType> | null,
): () => void {
  if (!isMobileUi()) return () => {};

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let moved = false;

  const place = (clientX: number, clientY: number) => {
    const series = getSeries();
    if (!series) return;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const price = series.coordinateToPrice(y);
    const time = chart.timeScale().coordinateToTime(x) as Time | null;
    if (price == null || time == null) return;
    chart.setCrosshairPosition(price, time, series);
  };

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startT = Date.now();
    moved = false;
  };

  const onMove = (event: TouchEvent) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - startX) > 12 || Math.abs(touch.clientY - startY) > 12) {
      moved = true;
    }
  };

  const onEnd = (event: TouchEvent) => {
    if (moved || event.changedTouches.length !== 1) return;
    if (Date.now() - startT > 450) return; // long-press / cancelled scroll
    const touch = event.changedTouches[0];
    place(touch.clientX, touch.clientY);
  };

  // All passive — never call preventDefault (that is what killed mobile scroll).
  host.addEventListener("touchstart", onStart, { passive: true });
  host.addEventListener("touchmove", onMove, { passive: true });
  host.addEventListener("touchend", onEnd, { passive: true });
  return () => {
    host.removeEventListener("touchstart", onStart);
    host.removeEventListener("touchmove", onMove);
    host.removeEventListener("touchend", onEnd);
  };
}
