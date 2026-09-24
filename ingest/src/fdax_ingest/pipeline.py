from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from fdax_ingest.config import Settings
from fdax_ingest.hours import next_poll_resume, quiet_reason, should_poll
from fdax_ingest.mfs import (
    MfsClient,
    is_daily_filename,
    iter_ndjson,
    parse_daily_date,
    parse_minute_filename,
)
from fdax_ingest.parse import keep_trade, normalize_trade
from fdax_ingest.store import TradeStore


@dataclass(frozen=True)
class IngestResult:
    files: list[str]
    records_seen: int
    records_kept: int
    records_upserted: int
    raw_paths: list[Path]


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def save_raw(raw_dir: Path, filename: str, payload: bytes) -> Path:
    raw_dir.mkdir(parents=True, exist_ok=True)
    path = raw_dir / filename
    path.write_bytes(payload)
    return path


def minute_files_in_window(
    filenames: list[str],
    start: datetime,
    end: datetime,
) -> list[str]:
    chosen: list[str] = []
    for name in filenames:
        ts = parse_minute_filename(name)
        if ts is None:
            continue
        if start <= ts < end:
            chosen.append(name)
    return sorted(chosen, key=lambda n: parse_minute_filename(n) or datetime.min)


def pending_minute_files(
    filenames: list[str],
    already: set[str],
    max_event_time: datetime | None,
    *,
    now: datetime | None = None,
    delay_seconds: int = 900,
) -> list[str]:
    """New minute files at the live edge; skip history already in the DB.

    A file named for minute T is only due after T + delay (MFS is 15 min late).
    """
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    ready_before = now - timedelta(seconds=delay_seconds)
    cutoff = None
    if max_event_time is not None:
        cutoff = max_event_time.replace(second=0, microsecond=0)
    pending: list[str] = []
    for name in filenames:
        ts = parse_minute_filename(name)
        if ts is None or name in already:
            continue
        if ts > ready_before:
            continue
        if not should_poll(ts):
            continue
        if cutoff is not None and ts < cutoff:
            continue
        pending.append(name)
    return sorted(pending, key=lambda n: parse_minute_filename(n) or datetime.min)


def _count_trades(payloads: dict[str, bytes], isin: str) -> tuple[int, int]:
    seen = 0
    kept = 0
    for payload in payloads.values():
        for record in iter_ndjson(payload):
            seen += 1
            if keep_trade(record, isin):
                kept += 1
    return seen, kept


def ingest_payloads(
    store: TradeStore,
    *,
    source: str,
    files: dict[str, bytes],
    isin: str,
) -> IngestResult:
    run_id = store.start_run(source, list(files.keys()))
    seen = 0
    kept_rows: list[dict] = []
    try:
        for payload in files.values():
            for record in iter_ndjson(payload):
                seen += 1
                if keep_trade(record, isin):
                    kept_rows.append(normalize_trade(record))
        upserted = store.upsert_trades_counted(run_id, kept_rows)
        store.finish_run(
            run_id,
            status="ok",
            records_seen=seen,
            records_kept=len(kept_rows),
            records_upserted=upserted,
        )
        return IngestResult(
            files=list(files.keys()),
            records_seen=seen,
            records_kept=len(kept_rows),
            records_upserted=upserted,
            raw_paths=[],
        )
    except Exception as exc:
        store.finish_run(
            run_id,
            status="error",
            records_seen=seen,
            records_kept=len(kept_rows),
            records_upserted=0,
            error=str(exc),
        )
        raise


def ingest_range(
    settings: Settings,
    start_local: datetime,
    end_local: datetime,
    *,
    dry_run: bool = False,
) -> IngestResult:
    tz = ZoneInfo(settings.tz)
    if start_local.tzinfo is None:
        start_local = start_local.replace(tzinfo=tz)
    if end_local.tzinfo is None:
        end_local = end_local.replace(tzinfo=tz)
    start = start_local.astimezone(ZoneInfo("UTC"))
    end = end_local.astimezone(ZoneInfo("UTC"))
    with MfsClient(settings.mfs_base_url, settings.source_prefix, settings.user_agent) as client:
        listing = client.list_files()
        names = minute_files_in_window(listing.get("CurrentFiles") or [], start, end)
        if not names:
            raise RuntimeError(
                f"Keine Minutendateien im Fenster {start.isoformat()} .. {end.isoformat()} UTC"
            )
        payloads: dict[str, bytes] = {}
        raw_paths: list[Path] = []
        for name in names:
            existing = settings.raw_dir / name
            if existing.exists() and existing.stat().st_size > 32:
                payload = existing.read_bytes()
                raw_paths.append(existing)
            else:
                payload = client.download(name)
                raw_paths.append(save_raw(settings.raw_dir, name, payload))
                time.sleep(0.45)
            payloads[name] = payload
        if dry_run:
            seen, kept = _count_trades(payloads, settings.fdax_isin)
            return IngestResult(
                files=list(payloads.keys()),
                records_seen=seen,
                records_kept=kept,
                records_upserted=0,
                raw_paths=raw_paths,
            )
        with TradeStore(settings.database_url) as store:
            result = ingest_payloads(
                store,
                source=f"range:{start.isoformat()}/{end.isoformat()}",
                files=payloads,
                isin=settings.fdax_isin,
            )
        return IngestResult(
            files=result.files,
            records_seen=result.records_seen,
            records_kept=result.records_kept,
            records_upserted=result.records_upserted,
            raw_paths=raw_paths,
        )


def ingest_daily(settings: Settings, day: str, *, dry_run: bool = False) -> IngestResult:
    filename = f"{settings.source_prefix}-daily-{day}.json.gz"
    with MfsClient(settings.mfs_base_url, settings.source_prefix, settings.user_agent) as client:
        listing = client.list_files()
        available = listing.get("CurrentFiles") or []
        if filename not in available:
            dailies = [n for n in available if is_daily_filename(n)]
            raise RuntimeError(
                f"{filename} nicht in der Liste. Verfuegbar: {dailies or 'keine daily-Datei'}"
            )
        payload = client.download(filename)
        raw_path = save_raw(settings.raw_dir, filename, payload)
        if dry_run:
            seen, kept = _count_trades({filename: payload}, settings.fdax_isin)
            return IngestResult(
                files=[filename],
                records_seen=seen,
                records_kept=kept,
                records_upserted=0,
                raw_paths=[raw_path],
            )
        with TradeStore(settings.database_url) as store:
            result = ingest_payloads(
                store,
                source=f"daily:{day}",
                files={filename: payload},
                isin=settings.fdax_isin,
            )
        return IngestResult(
            files=result.files,
            records_seen=result.records_seen,
            records_kept=result.records_kept,
            records_upserted=result.records_upserted,
            raw_paths=[raw_path],
        )


def daily_dates_from_listing(filenames: list[str]) -> list[str]:
    dates = {parse_daily_date(name) for name in filenames}
    return sorted(day for day in dates if day)


def available_dates_from_listing(filenames: list[str]) -> list[str]:
    dates: set[str] = set()
    for name in filenames:
        daily = parse_daily_date(name)
        if daily:
            dates.add(daily)
            continue
        ts = parse_minute_filename(name)
        if ts is not None:
            dates.add(ts.date().isoformat())
    return sorted(dates)


def ingest_available_days(settings: Settings, *, dry_run: bool = False) -> dict:
    with MfsClient(settings.mfs_base_url, settings.source_prefix, settings.user_agent) as client:
        listing = client.list_files()
        names = listing.get("CurrentFiles") or []
    wanted = available_dates_from_listing(names)
    dailies = set(daily_dates_from_listing(names))
    already: set[str] = set()
    try:
        with TradeStore(settings.database_url) as store:
            store.ensure_schema()
            already = store.stored_berlin_dates()
    except Exception:
        already = set()

    loaded: list[dict] = []
    skipped = [day for day in wanted if day in already]
    errors: list[dict] = []
    tz = ZoneInfo(settings.tz)
    for day in wanted:
        if day in already:
            continue
        try:
            if day in dailies:
                result = ingest_daily(settings, day, dry_run=dry_run)
                source = "daily"
            else:
                nxt = (date.fromisoformat(day) + timedelta(days=1)).isoformat()
                start = datetime.fromisoformat(f"{day}T00:00").replace(tzinfo=tz)
                end = datetime.fromisoformat(f"{nxt}T00:00").replace(tzinfo=tz)
                result = ingest_range(settings, start, end, dry_run=dry_run)
                source = "minutes"
            loaded.append(
                {
                    "date": day,
                    "source": source,
                    "records_kept": result.records_kept,
                    "records_upserted": result.records_upserted,
                }
            )
            time.sleep(0.45)
        except Exception as exc:
            errors.append({"date": day, "error": str(exc)})
    return {
        "available": wanted,
        "loaded": loaded,
        "skipped": skipped,
        "errors": errors,
    }


def probe(settings: Settings, limit: int = 8) -> dict:
    with MfsClient(settings.mfs_base_url, settings.source_prefix, settings.user_agent) as client:
        listing = client.list_files()
        files = listing.get("CurrentFiles") or []
        dailies = [n for n in files if is_daily_filename(n)]
        minutes = [n for n in files if parse_minute_filename(n)]
        sample_name = next(
            (n for n in minutes if parse_minute_filename(n) and parse_minute_filename(n).hour in range(7, 20)),
            minutes[0] if minutes else None,
        )
        sample_meta = None
        if sample_name:
            payload = client.download(sample_name)
            seen = kept = 0
            first_kept = None
            for record in iter_ndjson(payload):
                seen += 1
                if keep_trade(record, settings.fdax_isin):
                    kept += 1
                    if first_kept is None:
                        first_kept = normalize_trade(record)
            sample_meta = {
                "file": sample_name,
                "gz_bytes": len(payload),
                "records_seen": seen,
                "fdax_priced": kept,
                "first_event": first_kept["event_time"].isoformat() if first_kept else None,
                "first_price": first_kept["price"] if first_kept else None,
                "sha256": _sha256(payload),
            }
        return {
            "source": listing.get("SrcText"),
            "generated": listing.get("GenerationDatetime"),
            "file_count": listing.get("FileCount"),
            "days_on_page": listing.get("DaysToKeepOnWebpage"),
            "daily_files": dailies,
            "available_dates": available_dates_from_listing(files),
            "minute_files_preview": minutes[:limit],
            "sample": sample_meta,
        }


def follow_once(settings: Settings, store: TradeStore, client: MfsClient) -> dict:
    listing = client.list_files()
    names = listing.get("CurrentFiles") or []
    wanted = pending_minute_files(
        names,
        store.ingested_filenames(),
        store.max_event_time(),
        delay_seconds=settings.tape_delay_seconds,
    )
    if not wanted:
        return {"files": [], "records_upserted": 0, "pending": 0}

    files: dict[str, bytes] = {}
    hashes: dict[str, str] = {}
    for name in wanted:
        existing = settings.raw_dir / name
        if existing.exists() and existing.stat().st_size > 32:
            payload = existing.read_bytes()
        else:
            payload = client.download(name)
            save_raw(settings.raw_dir, name, payload)
            time.sleep(0.45)
        files[name] = payload
        hashes[name] = _sha256(payload)

    result = ingest_payloads(
        store,
        source=f"follow:{wanted[0]}:{wanted[-1]}",
        files=files,
        isin=settings.fdax_isin,
    )
    per_file = result.records_upserted if len(wanted) == 1 else 0
    for name in wanted:
        store.mark_ingested(name, hashes[name], per_file if per_file else result.records_upserted)
    return {
        "files": wanted,
        "records_seen": result.records_seen,
        "records_kept": result.records_kept,
        "records_upserted": result.records_upserted,
        "pending": len(wanted),
    }


def follow_forever(settings: Settings) -> None:
    settings.raw_dir.mkdir(parents=True, exist_ok=True)
    backoff = settings.follow_poll_seconds
    while True:
        now = datetime.now(timezone.utc)
        if not should_poll(now):
            wake = next_poll_resume(now)
            wait = max(1.0, (wake - now).total_seconds())
            print(
                {
                    "event": "follow_quiet",
                    "reason": quiet_reason(now),
                    "until": wake.isoformat(),
                    "sleep_s": round(min(wait, 6 * 3600)),
                },
                flush=True,
            )
            time.sleep(min(wait, 6 * 3600))
            continue
        try:
            with MfsClient(settings.mfs_base_url, settings.source_prefix, settings.user_agent) as client:
                with TradeStore(settings.database_url) as store:
                    store.ensure_schema()
                    store.touch_heartbeat("follow")
                    while should_poll(datetime.now(timezone.utc)):
                        summary = follow_once(settings, store, client)
                        store.touch_heartbeat("follow")
                        print(
                            {
                                "event": "follow_cycle",
                                "files": summary.get("files"),
                                "upserted": summary.get("records_upserted", 0),
                            },
                            flush=True,
                        )
                        backoff = settings.follow_poll_seconds
                        time.sleep(backoff)
        except Exception as exc:
            print({"event": "follow_error", "error": str(exc)}, flush=True)
            try:
                with TradeStore(settings.database_url) as store:
                    store.ensure_schema()
                    store.touch_heartbeat("error")
            except Exception:
                pass
            time.sleep(backoff)
            backoff = min(120.0, max(settings.follow_poll_seconds, backoff * 2))
