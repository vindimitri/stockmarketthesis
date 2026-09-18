from datetime import datetime, timezone

from fdax_ingest.pipeline import pending_minute_files


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
    pending = pending_minute_files(names, already, max_event)
    assert pending == ["DEUR-posttrade-2026-09-18T14_41.json.gz"]


def test_pending_bootstraps_all_minutes_on_empty_db():
    names = [
        "DEUR-posttrade-2026-09-18T14_40.json.gz",
        "DEUR-posttrade-2026-09-18T14_41.json.gz",
    ]
    pending = pending_minute_files(names, set(), None)
    assert pending == names
