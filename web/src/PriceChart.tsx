import { useLayoutEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  LineSeries,
  LineStyle,
  LineType,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { lineRange, type LinePoint } from "./linePoints";
import { berlinAxisTickLabel, berlinTimeLabel, formatPrice } from "./format";

const BG = "#ffffff";
const GRID = "#e4e9f2";
const LINE = "#1e6ee6";
const FILL_TOP = "rgba(30, 110, 230, 0.2)";
const FILL_BOTTOM = "rgba(11, 31, 58, 0.02)";
const MUTED = "#4a5160";
const TICK_UP = "#1a8a5c";
const TICK_DOWN = "#e11d3a";
const MARK_HIGH = "#229f6c";
const MARK_LOW = "#e11d3a";
const MARK_LAST = "#ff7a18";
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
  trackLast?: boolean;
  showSeconds?: boolean;
  locked?: boolean;
};

function axisTickLabel(time: Time, hoursOnly: boolean): string {
  return typeof time === "number" ? berlinAxisTickLabel(time, hoursOnly) : "";
}

function lastValued(points: LinePoint[]): LinePoint | undefined {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].value != null) return points[i];
  }
  return undefined;
}

function tickColor(prev: LinePoint[], next: LinePoint[], fallback: string): string {
  const last = lastValued(next);
  if (!last || last.value == null) return fallback;
  const prior = lastValued(prev) ?? (next.length >= 2 ? next[next.length - 2] : null);
  if (!prior || prior.value == null) return fallback;
  if (last.value > prior.value) return TICK_UP;
  if (last.value < prior.value) return TICK_DOWN;
  return fallback;
}

function seriesData(points: LinePoint[]) {
  return points.map((point) =>
    point.value == null
      ? { time: point.time as UTCTimestamp }
      : { time: point.time as UTCTimestamp, value: point.value },
  );
}

export function PriceChart({
  points,
  viewKey,
  lastTick = null,
  trackLast = false,
  showSeconds = false,
  locked = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const spacerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tickRef = useRef<ISeriesApi<"Line"> | null>(null);
  const highLineRef = useRef<IPriceLine | null>(null);
  const lowLineRef = useRef<IPriceLine | null>(null);
  const lastLineRef = useRef<IPriceLine | null>(null);
  const tickColorRef = useRef(TICK_UP);
  const flashTimerRef = useRef<number | null>(null);
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
        fontFamily: "IBM Plex Sans, sans-serif",
        fontSize: 12,
        attributionLogo: false,
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
        priceFormatter: (price: number) => formatPrice(price),
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

    const series = chart.addSeries(AreaSeries, {
      lineColor: LINE,
      topColor: FILL_TOP,
      bottomColor: FILL_BOTTOM,
      lineWidth: 2,
      lineType: LineType.Simple,
      relativeGradient: false,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      pointMarkersVisible: false,
      priceFormat: { type: "price", precision: 1, minMove: 0.5 },
    });

    const spacer = chart.addSeries(LineSeries, {
      color: "rgba(0,0,0,0)",
      lineVisible: false,
      pointMarkersVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
      autoscaleInfoProvider: () => null,
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

    const level = (color: string) =>
      series.createPriceLine({
        price: 0,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "",
      });
    highLineRef.current = level(MARK_HIGH);
    lowLineRef.current = level(MARK_LOW);

    chartRef.current = chart;
    seriesRef.current = series;
    spacerRef.current = spacer;
    tickRef.current = tick;

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", frameFit);
      if (flashTimerRef.current != null) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      spacerRef.current = null;
      tickRef.current = null;
      highLineRef.current = null;
      lastLineRef.current = null;
      lowLineRef.current = null;
    };
  }, []);

  const viewKeyRef = useRef(viewKey);
  const prevPointsRef = useRef<LinePoint[]>([]);
  const prevTickKeyRef = useRef("");

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
    const data = seriesData(points);
    const marks = lineRange(points);
    if (marks) {
      highLineRef.current?.applyOptions({
        price: marks.high,
        color: MARK_HIGH,
        axisLabelVisible: true,
      });
      lowLineRef.current?.applyOptions({
        price: marks.low,
        color: MARK_LOW,
        axisLabelVisible: true,
      });
    } else {
      highLineRef.current?.applyOptions({ color: "rgba(0,0,0,0)", axisLabelVisible: false });
      lowLineRef.current?.applyOptions({ color: "rgba(0,0,0,0)", axisLabelVisible: false });
    }
    const lastPrice = lastTick?.value ?? marks?.last;
    if (trackLast && lastPrice != null) {
      if (!lastLineRef.current) {
        lastLineRef.current = series.createPriceLine({
          price: lastPrice,
          color: MARK_LAST,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: "",
        });
      } else {
        lastLineRef.current.applyOptions({ price: lastPrice });
      }
    } else if (lastLineRef.current) {
      series.removePriceLine(lastLineRef.current);
      lastLineRef.current = null;
    }
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
      const lastLine = lastValued(next);
      if (!tick) return;
      if (!lastLine || lastLine.value == null || !flash) {
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
      if (locked) {
        const anchor = lastValued(points)?.value ?? 0;
        spacerRef.current?.setData(
          points.map((point) => ({ time: point.time as UTCTimestamp, value: anchor })),
        );
      } else {
        spacerRef.current?.setData([]);
      }
      applyTick(points, prev, false, null);
      if (reset) {
        if (locked && points.length) {
          chart.timeScale().setVisibleRange({
            from: points[0].time as UTCTimestamp,
            to: points[points.length - 1].time as UTCTimestamp,
          });
        } else {
          chart.timeScale().fitContent();
        }
        setHover(null);
      } else if (locked && points.length) {
        chart.timeScale().setVisibleRange({
          from: points[0].time as UTCTimestamp,
          to: points[points.length - 1].time as UTCTimestamp,
        });
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

    try {
      for (; i < points.length; i += 1) {
        const point = points[i];
        series.update(
          point.value == null
            ? { time: point.time as UTCTimestamp }
            : { time: point.time as UTCTimestamp, value: point.value },
        );
      }
      if (locked && points.length) {
        chart.timeScale().setVisibleRange({
          from: points[0].time as UTCTimestamp,
          to: points[points.length - 1].time as UTCTimestamp,
        });
      }
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
  }, [points, viewKey, lastTick, trackLast, locked, showSeconds]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-desk-ink-muted">
          <span className="mono text-desk-ink">{berlinTimeLabel(hover.time, true)}</span>
          <span>
            Preis <span className="mono text-desk-accent">{formatPrice(hover.price)}</span>
          </span>
        </div>
      )}
      <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden" />
    </div>
  );
}
