const berlin = "Europe/Berlin";

export function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Math.round(value).toLocaleString("de-DE");
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
}

export function parseYmd(value: string | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

export function berlinTimeLabel(unixSec: number, withSeconds: boolean): string {
  return new Date(unixSec * 1000).toLocaleTimeString("de-DE", {
    timeZone: berlin,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

function berlinClockParts(unixSec: number): { hour: string; minute: string; second: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: berlin,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(unixSec * 1000));
  return {
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00",
    second: parts.find((part) => part.type === "second")?.value ?? "00",
  };
}

export function berlinAxisTickLabel(unixSec: number, hoursOnly = false): string {
  const { hour, minute, second } = berlinClockParts(unixSec);
  if (second !== "00") return "";
  if (hoursOnly) {
    if (minute !== "00") return "";
    return `${hour}:00`;
  }
  if (minute !== "00" && minute !== "30") return "";
  return `${hour}:${minute}`;
}

export function berlinTodayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: berlin,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

const berlinWallFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: berlin,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function berlinWallParts(ms: number) {
  const parts = berlinWallFmt.formatToParts(new Date(ms));
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
  };
}

function berlinWallTimeUtcMs(ymd: string, hour: number, minute = 0, second = 0): number {
  const [year, month, day] = ymd.split("-").map(Number);
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const got = berlinWallParts(utc);
    const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const wantUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = wantUtc - gotUtc;
    if (delta === 0) break;
    utc += delta;
  }
  return utc;
}

/** Desk-Session: 08:00–22:00 Berlin. */
function berlinSessionRange(ymd: string): { from: number; to: number } | null {
  if (!ymd) return null;
  const from = Math.floor(berlinWallTimeUtcMs(ymd, 8, 0) / 1000);
  const to = Math.floor(berlinWallTimeUtcMs(ymd, 22, 0) / 1000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

export function berlinChartRange(
  ymd: string,
  window: "day" | "1718",
): { from: number; to: number } | null {
  if (!ymd) return null;
  if (window === "1718") {
    const from = Math.floor(berlinWallTimeUtcMs(ymd, 17, 0) / 1000);
    const to = Math.floor(berlinWallTimeUtcMs(ymd, 18, 0) / 1000);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
    return { from, to };
  }
  return berlinSessionRange(ymd);
}

function lowerBoundByEventTime(trades: { event_time: string }[], ms: number): number {
  let lo = 0;
  let hi = trades.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (Date.parse(trades[mid].event_time) < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function sliceTradesByBerlinHours<T extends { event_time: string }>(
  trades: T[],
  ymd: string,
  startHour: number,
  endHour: number,
): T[] {
  if (!trades.length || !ymd) return trades;
  const startMs = berlinWallTimeUtcMs(ymd, startHour);
  const endMs = berlinWallTimeUtcMs(ymd, endHour);
  return trades.slice(lowerBoundByEventTime(trades, startMs), lowerBoundByEventTime(trades, endMs));
}
