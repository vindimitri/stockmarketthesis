from datetime import date, time

import pytest
from fastapi import HTTPException

from fdax_api.timewin import berlin_window, parse_bound, parse_hhmm


def test_parse_hhmm():
    assert parse_hhmm("17:00", field="from") == time(17, 0)
    assert parse_hhmm("18:00", field="to") == time(18, 0)


def test_parse_hhmm_rejects_garbage():
    with pytest.raises(HTTPException) as exc:
        parse_hhmm("17", field="from")
    assert exc.value.status_code == 422


def test_parse_bound_end_of_day():
    bound = parse_bound("24:00", field="to")
    assert bound.next_day is True
    assert bound.clock == time(0, 0)


def test_parse_bound_rejects_24_as_from():
    with pytest.raises(HTTPException) as exc:
        parse_bound("24:00", field="from")
    assert exc.value.status_code == 422


def test_berlin_window_is_exclusive_end():
    start, end = berlin_window(date(2026, 9, 17), time(17, 0), time(18, 0), "Europe/Berlin")
    assert start.hour == 17
    assert end.hour == 18
    assert start.tzinfo is not None
    assert end > start


def test_berlin_window_full_day():
    start, end = berlin_window(
        date(2026, 9, 17),
        time(0, 0),
        time(0, 0),
        "Europe/Berlin",
        end_next_day=True,
    )
    assert start.day == 17
    assert end.day == 18
    assert end.hour == 0
