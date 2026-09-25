from datetime import datetime, timezone

from fdax_ingest.pipeline import pending_minute_files

NOW = datetime(2026, 9, 18, 16, 0, tzinfo=timezone.utc)


def test_pending_skips_known_and_older_minutes():
    names = [
        "DEUR-posttrade-2026-09-18T14_38.json.gz",
        "DEUR-posttrade-2026-09-18T14_39.json.gz",
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-18T14_41.json.gz",
        "DEUR-posttrade-daily-2026-09-17.json.gz",
    ]
    already = {"DEUR-posttrade-2026-09-18T14_40.json.gz"}
    max_event = datetime(2026, 9, 18, 14, 40, 56, tzinfo=timezone.utc)
    pending = pending_minute_files(names, already, max_event, now=NOW)
    assert pending == ["DEUR-posttrade-2026-09-18T14_41.json.gz"]


def test_pending_bootstraps_all_minutes_on_empty_db():
    names = [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-18T14_41.json.gz",
    ]
    pending = pending_minute_files(names, set(), None, now=NOW)
    assert pending == names


def test_pending_skips_weekend_and_overnight_minutes():
    names = [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-18T21_10.json.gz",
        "DEUR-posttrade-2026-09-19T10_00.json.gz",
        "DEUR-posttrade-2026-09-21T00_00.json.gz",
        "DEUR-posttrade-2026-09-21T00_20.json.gz",
        "DEUR-posttrade-2026-09-21T06_20.json.gz",
    ]
    pending = pending_minute_files(
        names,
        set(),
        None,
        now=datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc),
    )
    assert pending == [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-21T06_20.json.gz",
    ]


def test_pending_waits_fifteen_minutes_after_file_minute():
    names = [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-18T14_41.json.gz",
    ]
    too_early = datetime(2026, 9, 18, 14, 50, tzinfo=timezone.utc)
    due = datetime(2026, 9, 18, 14, 55, tzinfo=timezone.utc)
    assert pending_minute_files(names, set(), None, now=too_early) == []
    assert pending_minute_files(names, set(), None, now=due) == [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
    ]
