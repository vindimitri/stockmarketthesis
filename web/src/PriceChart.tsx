import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  LineSeries,
  LineType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { LinePoint } from "./candles";
import { berlinAxisTickLabel, berlinTimeLabel, formatPrice } from "./format";

const BG = "#f4f4f4";
const GRID = "#d4d4d8";
const LINE = "#1e6fd9";
const FILL_TOP = "rgba(30, 111, 217, 0.34)";
const FILL_BOTTOM = "rgba(30, 111, 217, 0.02)";
const MUTED = "#52525b";
const TICK_UP = "#16a34a";
const TICK_DOWN = "#e11d48";
const TICK_FLASH_MS = 280;

type Hover = { time: number; price: number } | null;

type TickPrint = {
  time: number;
  value: number;
  key: string;
};

type Props = {
  points: LinePoint[];
  viewKey: string;
  lastTick?: TickPrint | null;
};

function axisTickLabel(time: Time): string {
  return typeof time === "number" ? berlinAxisTickLabel(time) : "";
}

function tickColor(prev: LinePoint[], next: LinePoint[], fallback: string): string {
  const last = next.at(-1);
  if (!last) return fallback;
  const prior = prev.at(-1);
  const compare = prior ?? (next.length >= 2 ? next[next.length - 2] : null);
  if (!compare) return fallback;
  if (last.value > compare.value) return TICK_UP;
  if (last.value < compare.value) return TICK_DOWN;
  return fallback;
}

export function PriceChart({ points, viewKey, lastTick = null }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tickRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tickColorRef = useRef(TICK_UP);
  const flashTimerRef = useRef<number | null>(null);
  const [hover, setHover] = useState<Hover>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: MUTED,
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: {
        borderColor: GRID,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        tickMarkFormatter: axisTickLabel,
      },
      localization: {
        locale: "de-DE",
        timeFormatter: (time: UTCTimestamp) => berlinTimeLabel(time, true),
        priceFormatter: (price: number) => formatPrice(price),
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#d4d4d8", labelBackgroundColor: "#27272a" },
        horzLine: { color: "#d4d4d8", labelBackgroundColor: "#27272a" },
      },
      autoSize: true,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: LINE,
      topColor: FILL_TOP,
      bottomColor: FILL_BOTTOM,
      lineWidth: 2,
      lineType: LineType.Simple,
      relativeGradient: false,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      pointMarkersVisible: false,
    });

    const tick = chart.addSeries(LineSeries, {
      color: TICK_UP,
      lineVisible: false,
      pointMarkersVisible: true,
      pointMarkersRadius: 6,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
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
      setHover({ time: param.time as number, price: point.value });
    });

    chartRef.current = chart;
    seriesRef.current = series;
    tickRef.current = tick;

    return () => {
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      tickRef.current = null;
    };
  }, []);

  const viewKeyRef = useRef(viewKey);
  const prevPointsRef = useRef<LinePoint[]>([]);
  const prevTickKeyRef = useRef("");

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    const data = points.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.value,
    }));
    const prev = prevPointsRef.current;
    const reset = viewKeyRef.current !== viewKey;
    viewKeyRef.current = viewKey;

    const hideTick = () => {
      tickRef.current?.setData([]);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
    };

    const applyTick = (
      next: LinePoint[],
      previous: LinePoint[],
      flash: boolean,
      print: TickPrint | null,
    ) => {
      const tick = tickRef.current;
      const lastLine = next.at(-1);
      if (!tick) return;
      if (!lastLine || !flash) {
        hideTick();
        return;
      }
      const value = print?.value ?? lastLine.value;
      const color = tickColor(previous, next, tickColorRef.current);
      tickColorRef.current = color;
      tick.applyOptions({ color });
      tick.setData([{ time: lastLine.time as UTCTimestamp, value }]);
      if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => {
        tickRef.current?.setData([]);
        flashTimerRef.current = null;
      }, TICK_FLASH_MS);
    };

    const applyFull = () => {
      series.setData(data);
      applyTick(points, prev, false, null);
      if (reset) {
        chart.timeScale().fitContent();
        setHover(null);
      }
    };

    if (reset || !prev.length || !points.length) {
      applyFull();
      prevPointsRef.current = points;
      prevTickKeyRef.current = lastTick?.key ?? "";
      return;
    }

    let i = 0;
    const n = Math.min(prev.length, points.length);
    while (i < n && prev[i].time === points[i].time && prev[i].value === points[i].value) {
      i += 1;
    }
    const timesBroke = i < n && prev[i].time !== points[i].time;
    if (timesBroke || points.length < prev.length) {
      applyFull();
      prevPointsRef.current = points;
      prevTickKeyRef.current = lastTick?.key ?? "";
      return;
    }

    const range = chart.timeScale().getVisibleLogicalRange();
    const pinned = range != null && range.to >= prev.length - 3;
    try {
      for (; i < points.length; i += 1) {
        series.update({
          time: points[i].time as UTCTimestamp,
          value: points[i].value,
        });
      }
      if (pinned) chart.timeScale().scrollToRealTime();
    } catch {
      applyFull();
      prevPointsRef.current = points;
      prevTickKeyRef.current = lastTick?.key ?? "";
      return;
    }
    const tickKey = lastTick?.key ?? "";
    const tickArrived = Boolean(tickKey) && tickKey !== prevTickKeyRef.current;
    prevTickKeyRef.current = tickKey;
    if (tickArrived) applyTick(points, prev, true, lastTick);
    prevPointsRef.current = points;
  }, [points, viewKey, lastTick]);

  return (
    <div className="relative h-full min-h-[360px]">
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-zinc-600">
          <span className="mono text-zinc-900">{berlinTimeLabel(hover.time, true)}</span>
          <span>
            Preis <span className="mono text-blue-800">{formatPrice(hover.price)}</span>
          </span>
        </div>
      )}
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
