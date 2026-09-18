from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fdax_ingest.hours import (
    easter_sunday,
    is_exchange_day,
    next_poll_resume,
    poll_window,
    should_poll,
)

BERLIN = ZoneInfo("Europe/Berlin")


def _at(iso: str) -> datetime:
    return datetime.fromisoformat(iso)


def test_easter_2026():
    assert easter_sunday(2026) == date(2026, 4, 5)


def test_weekdays_and_holidays():
    assert is_exchange_day(date(2026, 9, 18))
    assert not is_exchange_day(date(2026, 9, 19))
    assert not is_exchange_day(date(2026, 9, 20))
    assert not is_exchange_day(date(2026, 1, 1))
    assert not is_exchange_day(date(2026, 4, 3))
    assert not is_exchange_day(date(2026, 4, 6))
    assert not is_exchange_day(date(2026, 5, 1))
    assert not is_exchange_day(date(2026, 12, 24))
    assert not is_exchange_day(date(2026, 12, 25))
    assert not is_exchange_day(date(2026, 12, 31))


def test_summer_session_is_cest():
    assert should_poll(_at("2026-09-18T10:00:00+02:00"))
    assert should_poll(_at("2026-09-18T02:15:00+02:00"))
    assert not should_poll(_at("2026-09-18T01:30:00+02:00"))
    assert should_poll(_at("2026-09-18T22:20:00+02:00"))
    assert not should_poll(_at("2026-09-18T23:00:00+02:00"))


def test_winter_session_is_cet():
    assert should_poll(_at("2026-01-07T01:15:00+01:00"))
    assert not should_poll(_at("2026-01-07T00:30:00+01:00"))
    assert should_poll(_at("2026-01-07T21:50:00+01:00"))


def test_weekend_and_holiday_quiet():
    assert not should_poll(_at("2026-09-19T12:00:00+02:00"))
    assert not should_poll(_at("2026-04-03T12:00:00+02:00"))


def test_resume_after_friday_close_is_monday_open():
    resume = next_poll_resume(_at("2026-09-18T23:10:00+02:00"))
    start, _ = poll_window(date(2026, 9, 21))
    assert start is not None
    assert resume == start
    assert resume.astimezone(timezone.utc).hour == 0
    assert resume.astimezone(timezone.utc).minute == 5
