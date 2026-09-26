import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";

/**
 * Finger crosshair without long-press.
 * Vertical pans are left to the page (mobile scroll); only intentional
 * horizontal / stationary drags steal the gesture.
 */
export function attachTouchCrosshair(
  host: HTMLElement,
  chart: IChartApi,
  getSeries: () => ISeriesApi<SeriesType> | null,
): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onStart = (event: TouchEvent) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = false;
    place(touch.clientX, touch.clientY, false);
  };

  const onMove = (event: TouchEvent) => {
    if (!event.touches.length) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!tracking) {
      // Mostly vertical → browser/page scroll wins.
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) return;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      tracking = true;
    }
    event.preventDefault();
    place(touch.clientX, touch.clientY, true);
  };

  const place = (clientX: number, clientY: number, _forced: boolean) => {
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

  host.addEventListener("touchstart", onStart, { passive: true });
  host.addEventListener("touchmove", onMove, { passive: false });
  return () => {
    host.removeEventListener("touchstart", onStart);
    host.removeEventListener("touchmove", onMove);
  };
}
