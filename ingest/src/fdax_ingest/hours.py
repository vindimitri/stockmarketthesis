from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")

# FDAX continuous trading (Eurex T7): 00:10 UTC until 22:00 Europe/Berlin.
# Winter 01:10–22:00 CET, summer 02:10–22:00 CEST. Closed weekends and the
# Eurex all-derivatives holidays (NYD, Good Friday, Easter Monday, 1 May,
# 24/25/31 Dec). Poll a few minutes early and after close for delayed files.
OPEN_UTC = time(0, 10)
CLOSE_BERLIN = time(22, 0)
OPEN_LEAD = timedelta(minutes=5)
CLOSE_TAIL = timedelta(minutes=45)


def easter_sunday(year: int) -> date:
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def eurex_closed_dates(year: int) -> set[date]:
    easter = easter_sunday(year)
    return {
        date(year, 1, 1),
        easter - timedelta(days=2),
        easter + timedelta(days=1),
        date(year, 5, 1),
        date(year, 12, 24),
        date(year, 12, 25),
        date(year, 12, 31),
    }


def is_exchange_day(day: date) -> bool:
    if day.weekday() >= 5:
        return False
    return day not in eurex_closed_dates(day.year)


def poll_window(day: date) -> tuple[datetime, datetime] | None:
    if not is_exchange_day(day):
        return None
    start = datetime.combine(day, OPEN_UTC, tzinfo=timezone.utc) - OPEN_LEAD
    end = datetime.combine(day, CLOSE_BERLIN, tzinfo=BERLIN) + CLOSE_TAIL
    return start, end.astimezone(timezone.utc)


def should_poll(now: datetime) -> bool:
    now = now.astimezone(timezone.utc)
    day = now.astimezone(BERLIN).date()
    window = poll_window(day)
    if window is None:
        return False
    start, end = window
    return start <= now < end


def quiet_reason(now: datetime) -> str:
    """Why follow is idle: weekend, holiday, before_open, after_close, or open."""
    now = now.astimezone(timezone.utc)
    berlin_day = now.astimezone(BERLIN).date()
    if berlin_day.weekday() >= 5:
        return "weekend"
    if berlin_day in eurex_closed_dates(berlin_day.year):
        return "holiday"
    window = poll_window(berlin_day)
    if window is None:
        return "closed"
    start, end = window
    if now < start:
        return "before_open"
    if now >= end:
        return "after_close"
    return "open"


def next_poll_resume(now: datetime) -> datetime:
    now = now.astimezone(timezone.utc)
    if should_poll(now):
        return now
    berlin_day = now.astimezone(BERLIN).date()
    for offset in range(0, 12):
        day = berlin_day + timedelta(days=offset)
        window = poll_window(day)
        if window is None:
            continue
        start, end = window
        if now < start:
            return start
        if start <= now < end:
            return now
    return now + timedelta(hours=6)
