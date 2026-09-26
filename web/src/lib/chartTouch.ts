import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";

/** Finger tracking without long-press (LWC default). Keep crosshair after lift so the tooltip stays readable. */
export function attachTouchCrosshair(
  host: HTMLElement,
  chart: IChartApi,
  getSeries: () => ISeriesApi<SeriesType> | null,
): () => void {
  const track = (event: TouchEvent) => {
    if (!event.touches.length) return;
    const series = getSeries();
    if (!series) return;
    const rect = host.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const price = series.coordinateToPrice(y);
    const time = chart.timeScale().coordinateToTime(x) as Time | null;
    if (price == null || time == null) return;
    event.preventDefault();
    chart.setCrosshairPosition(price, time, series);
  };

  host.addEventListener("touchstart", track, { passive: false });
  host.addEventListener("touchmove", track, { passive: false });
  return () => {
    host.removeEventListener("touchstart", track);
    host.removeEventListener("touchmove", track);
  };
}
