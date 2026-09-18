from __future__ import annotations

import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from fdax_ingest.config import Settings
from fdax_ingest.pipeline import follow_forever, ingest_daily, ingest_range, probe


def _parse_local(ts: str, tz_name: str) -> datetime:
    tz = ZoneInfo(tz_name)
    formats = ("%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M")
    for fmt in formats:
        try:
            return datetime.strptime(ts, fmt).replace(tzinfo=tz)
        except ValueError:
            continue
    raise SystemExit(f"Ungueltige Zeit '{ts}', erwartet YYYY-MM-DDTHH:MM")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="fdax-ingest",
        description="Delayed Eurex FDAX Post-Trade von der Deutschen Boerse laden.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe", help="Dateiliste und ein Minuten-Sample anzeigen")

    p_range = sub.add_parser("ingest-range", help="Minutenfiles in einem lokalen Zeitfenster")
    p_range.add_argument("--start", required=True, help="z.B. 2026-09-17T17:00")
    p_range.add_argument("--end", required=True, help="z.B. 2026-09-17T18:00")
    p_range.add_argument(
        "--dry-run",
        action="store_true",
        help="Nur laden und zaehlen, nicht in die Datenbank schreiben",
    )

    p_day = sub.add_parser("ingest-daily", help="Konsolidierte Tagesdatei (Vortag)")
    p_day.add_argument("--date", required=True, help="YYYY-MM-DD der daily-Datei")
    p_day.add_argument("--dry-run", action="store_true")

    sub.add_parser("follow", help="Neue Minutenfiles dauerhaft nachladen")

    args = parser.parse_args(argv)
    settings = Settings()

    if args.cmd == "probe":
        print(json.dumps(probe(settings), indent=2, default=str))
        return 0

    if args.cmd == "ingest-range":
        start = _parse_local(args.start, settings.tz)
        end = _parse_local(args.end, settings.tz)
        result = ingest_range(settings, start, end, dry_run=args.dry_run)
        print(json.dumps(result.__dict__, indent=2, default=str))
        return 0

    if args.cmd == "ingest-daily":
        result = ingest_daily(settings, args.date, dry_run=args.dry_run)
        print(json.dumps(result.__dict__, indent=2, default=str))
        return 0

    if args.cmd == "follow":
        follow_forever(settings)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
