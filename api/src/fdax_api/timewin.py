from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException


@dataclass(frozen=True)
class ClockBound:
    clock: time
    next_day: bool = False


def parse_hhmm(value: str, *, field: str) -> time:
    try:
        hour_s, minute_s = value.strip().split(":", 1)
        hour = int(hour_s)
        minute = int(minute_s)
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            raise ValueError
        return time(hour, minute)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"{field} muss HH:MM sein, bekommen: {value!r}",
        ) from None


def parse_bound(value: str, *, field: str) -> ClockBound:
    raw = value.strip()
    if raw == "24:00":
        if field != "to":
            raise HTTPException(status_code=422, detail="from darf nicht 24:00 sein")
        return ClockBound(time(0, 0), next_day=True)
    return ClockBound(parse_hhmm(raw, field=field))


def berlin_window(
    day: date,
    start: time,
    end: time,
    tz_name: str,
    *,
    end_next_day: bool = False,
) -> tuple[datetime, datetime]:
    tz = ZoneInfo(tz_name)
    start_dt = datetime.combine(day, start, tzinfo=tz)
    if end_next_day:
        end_dt = datetime.combine(day + timedelta(days=1), time(0, 0), tzinfo=tz)
    else:
        end_dt = datetime.combine(day, end, tzinfo=tz)
    if end_dt <= start_dt:
        raise HTTPException(status_code=422, detail="to muss nach from liegen")
    return start_dt, end_dt
