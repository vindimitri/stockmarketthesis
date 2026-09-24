import type { TradeRow } from "./api";

export type LinePoint = {
  time: number;
  value?: number;
};

const MAX_POINTS = 8000;
const NICE_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600];

export function lineRange(points: LinePoint[]): { high: number; low: number; last: number } | null {
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  let last: number | undefined;
  for (const point of points) {
    if (point.value == null) continue;
    if (point.value > high) high = point.value;
    if (point.value < low) low = point.value;
    last = point.value;
  }
  if (last == null) return null;
  return { high, low, last };
}

export function toSessionPoints(
  trades: TradeRow[],
  bucketSec: number,
  fromSec: number,
  toSec: number,
): LinePoint[] {
  const step = Math.max(1, bucketSec);
  const start = Math.floor(fromSec / step) * step;
  const map = new Map<number, number>();
  let lastTradeSec = -1;
  for (const trade of trades) {
    const t = Math.floor(new Date(trade.event_time).getTime() / 1000);
    if (t < fromSec || t >= toSec) continue;
    const bucket = Math.floor(t / step) * step;
    map.set(bucket, trade.price);
    if (t > lastTradeSec) lastTradeSec = t;
  }
  const lastBucket = lastTradeSec >= 0 ? Math.floor(lastTradeSec / step) * step : -1;
  const out: LinePoint[] = [];
  let hold: number | undefined;
  for (let t = start; t <= toSec; t += step) {
    const hit = map.get(t);
    if (hit != null) {
      hold = hit;
      out.push({ time: t, value: hold });
    } else if (hold != null && t <= lastBucket) {
      out.push({ time: t, value: hold });
    } else {
      out.push({ time: t });
    }
  }
  return out;
}

export function toLinePoints(trades: TradeRow[], bucketSec = 60): LinePoint[] {
  const map = new Map<number, number>();
  for (const trade of trades) {
    const bucket =
      Math.floor(new Date(trade.event_time).getTime() / 1000 / bucketSec) * bucketSec;
    map.set(bucket, trade.price);
  }
  const points = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time, value }));
  return downsample(points, MAX_POINTS);
}

function niceTimeStep(minStepSec: number): number {
  return NICE_STEPS.find((step) => step >= minStepSec) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

function downsample(points: LinePoint[], maxPoints: number): LinePoint[] {
  if (points.length <= maxPoints) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.value == null || last.value == null) return points;
  const span = Math.max(1, last.time - first.time);
  const step = niceTimeStep(Math.ceil(span / Math.max(1, maxPoints - 1)));
  const gridStart = Math.ceil(first.time / step) * step;

  const out: LinePoint[] = [];
  let i = 0;
  let value = first.value;

  const push = (time: number, next: number) => {
    const prev = out[out.length - 1];
    if (prev?.time === time) {
      prev.value = next;
      return;
    }
    out.push({ time, value: next });
  };

  push(first.time, first.value);
  for (let t = gridStart; t < last.time; t += step) {
    while (i + 1 < points.length && points[i + 1].time <= t) {
      i += 1;
      value = points[i].value ?? value;
    }
    if (t > first.time) push(t, value);
  }
  push(last.time, last.value);
  return out;
}
