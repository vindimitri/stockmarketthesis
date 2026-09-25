import { useLayoutEffect, useRef, useState } from "react";
import {
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { berlinAxisTickLabel, berlinTimeLabel, formatInt } from "./format";
import type { LinePoint } from "./linePoints";

const BG = "#ffffff";
const GRID = "#e4e9f2";
const BAR = "#1e6ee6";
const MUTED = "#4a5160";

type Hover = { time: number; qty: number } | null;

type Props = {
  points: LinePoint[];
  viewKey: string;
  showSeconds?: boolean;
  locked?: boolean;
};

function axisTickLabel(time: Time, hoursOnly: boolean): string {
  return typeof time === "number" ? berlinAxisTickLabel(time, hoursOnly) : "";
}

function seriesData(points: LinePoint[]) {
  return points.map((point) => ({
    time: point.time as UTCTimestamp,
    value: point.value ?? 0,
    color: BAR,
  }));
}

export function QuantityChart({
  points,
  viewKey,
  showSeconds = false,
  locked = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lockedRef = useRef(locked);
  const showSecondsRef = useRef(showSeconds);
  lockedRef.current = locked;
  showSecondsRef.current = showSeconds;
  const [hover, setHover] = useState<Hover>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontFamily: "Outfit, sans-serif",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: {
        borderColor: GRID,
        scaleMargins: { top: 0.08, bottom: 0.02 },
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        lockVisibleTimeRangeOnResize: true,
        shiftVisibleRangeOnNewBar: false,
        rightBarStaysOnScroll: false,
        tickMarkFormatter: (time: Time) =>
          axisTickLabel(time, lockedRef.current && !showSecondsRef.current),
      },
      localization: {
        locale: "de-DE",
        timeFormatter: (time: UTCTimestamp) => berlinTimeLabel(time, true),
        priceFormatter: (price: number) => formatInt(price),
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#dcdfe5", labelBackgroundColor: "#1e6ee6" },
        horzLine: { color: "#dcdfe5", labelBackgroundColor: "#1e6ee6" },
      },
      autoSize: false,
      handleScale: {
        mouseWheel: false,
        pinch: false,
        axisPressedMouseMove: false,
        axisDoubleClickReset: false,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
      },
    });

    let lastW = 0;
    let lastH = 0;
    const fit = () => {
      const width = Math.floor(host.clientWidth);
      const height = Math.floor(host.clientHeight);
      if (width < 2 || height < 2) return;
      if (width === lastW && height === lastH) return;
      lastW = width;
      lastH = height;
      chart.resize(width, height, true);
    };

    let raf = 0;
    const frameFit = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        fit();
      });
    };

    fit();
    const ro = new ResizeObserver(frameFit);
    ro.observe(host);
    window.addEventListener("resize", frameFit);

    const series = chart.addSeries(HistogramSeries, {
      color: BAR,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "volume" },
    });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHover(null);
        return;
      }
      const point = param.seriesData.get(series) as { value: number } | undefined;
      if (!point) {
        setHover(null);
        return;
      }
      setHover({ time: param.time as number, qty: point.value });
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", frameFit);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const viewKeyRef = useRef(viewKey);

  useLayoutEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    chart.applyOptions({
      timeScale: {
        secondsVisible: showSeconds,
        rightOffset: locked ? 0 : 4,
        shiftVisibleRangeOnNewBar: !locked,
        tickMarkFormatter: (time: Time) => axisTickLabel(time, locked && !showSeconds),
      },
      handleScale: {
        mouseWheel: !locked,
        pinch: !locked,
        axisPressedMouseMove: !locked,
        axisDoubleClickReset: !locked,
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: !locked,
        horzTouchDrag: !locked,
        vertTouchDrag: !locked,
      },
    });
    series.setData(seriesData(points));
    const reset = viewKeyRef.current !== viewKey;
    viewKeyRef.current = viewKey;
    if (locked && points.length) {
      chart.timeScale().setVisibleRange({
        from: points[0].time as UTCTimestamp,
        to: points[points.length - 1].time as UTCTimestamp,
      });
    } else if (reset) {
      chart.timeScale().fitContent();
      setHover(null);
    }
  }, [points, viewKey, locked, showSeconds]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-desk-ink-muted">
          <span className="mono text-desk-ink">{berlinTimeLabel(hover.time, true)}</span>
          <span>
            Qty <span className="mono text-desk-accent">{formatInt(hover.qty)}</span>
          </span>
        </div>
      )}
      <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden" />
    </div>
  );
}
