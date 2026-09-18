import gzip
from datetime import datetime, timezone
from pathlib import Path

from fdax_ingest.mfs import is_daily_filename, iter_ndjson, parse_minute_filename
from fdax_ingest.parse import keep_trade, normalize_trade, parse_trading_time
from fdax_ingest.pipeline import minute_files_in_window as window_select

FIXTURE = Path(__file__).parent / "fixtures" / "minute_sample.ndjson"
ISIN = "DE0009652388"


def test_nanosecond_timestamp_truncates_to_microseconds():
    ts = parse_trading_time("2026-09-17T15:05:00.004299565Z")
    assert ts.tzinfo is not None
    assert ts.year == 2026
    assert ts.minute == 5
    assert ts.microsecond == 4299


def test_fixture_keeps_priced_fdax_only():
    payload = FIXTURE.read_bytes()
    records = list(iter_ndjson(payload))
    kept = [normalize_trade(r) for r in records if keep_trade(r, ISIN)]
    assert len(records) == 6
    assert len(kept) == 4
    assert all(row["isin"] == ISIN for row in kept)
    assert all(row["price"] for row in kept)
    assert kept[0]["external_id"]


def test_minute_filename_is_utc():
    ts = parse_minute_filename("DEUR-posttrade-2026-09-17T15_05.json.gz")
    assert ts == datetime(2026, 9, 17, 15, 5, tzinfo=timezone.utc)
    assert parse_minute_filename("DEUR-posttrade-daily-2026-09-16.json.gz") is None
    assert is_daily_filename("DEUR-posttrade-daily-2026-09-16.json.gz")


def test_window_selects_inclusive_start_exclusive_end():
    names = [
        "DEUR-posttrade-2026-09-17T14_59.json.gz",
        "DEUR-posttrade-2026-09-17T15_00.json.gz",
        "DEUR-posttrade-2026-09-17T15_59.json.gz",
        "DEUR-posttrade-2026-09-17T16_00.json.gz",
        "DEUR-posttrade-daily-2026-09-16.json.gz",
    ]
    start = datetime(2026, 9, 17, 15, 0, tzinfo=timezone.utc)
    end = datetime(2026, 9, 17, 16, 0, tzinfo=timezone.utc)
    chosen = window_select(names, start, end)
    assert chosen == [
        "DEUR-posttrade-2026-09-17T15_00.json.gz",
        "DEUR-posttrade-2026-09-17T15_59.json.gz",
    ]


def test_empty_gzip_yields_no_records():
    empty = gzip.compress(b"")
    assert list(iter_ndjson(empty)) == []
    assert list(iter_ndjson(b"")) == []
