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

export function formatClock(iso: string, withMs = false): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("de-DE", {
    timeZone: berlin,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    ...(withMs ? { fractionalSecondDigits: 3 } : {}),
  });
}

export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
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

export function berlinAxisTickLabel(unixSec: number): string {
  const { hour, minute, second } = berlinClockParts(unixSec);
  if (second !== "00") return "";
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

export function berlinMinutesOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: berlin,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function inBerlinHourRange(iso: string, startHour: number, endHour: number): boolean {
  const minutes = berlinMinutesOfDay(iso);
  return minutes >= startHour * 60 && minutes < endHour * 60;
}
