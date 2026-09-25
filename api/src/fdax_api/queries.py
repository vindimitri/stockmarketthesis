from datetime import date, datetime, timedelta, timezone

import psycopg
from psycopg.errors import UndefinedTable

from fdax_api.schemas import dec

HEARTBEAT_MAX_AGE = timedelta(seconds=90)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def ping(conn: psycopg.Connection) -> None:
    conn.execute("SELECT 1")


def last_ingest(conn: psycopg.Connection) -> dict | None:
    row = conn.execute(
        """
        SELECT id, status, source, started_at, finished_at,
               records_seen, records_kept, records_upserted, error
        FROM ingest_runs
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()
    if not row:
        return None
    data = dict(row)
    data["finished_at"] = _iso(data.get("finished_at"))
    data["started_at"] = _iso(data.get("started_at"))
    return data


def ingest_active(conn: psycopg.Connection) -> bool:
    try:
        row = conn.execute("SELECT beat_at FROM ingest_heartbeat WHERE id = 1").fetchone()
    except UndefinedTable:
        return False
    if not row or row["beat_at"] is None:
        return False
    beat = row["beat_at"]
    if beat.tzinfo is None:
        beat = beat.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - beat <= HEARTBEAT_MAX_AGE


def list_days(conn: psycopg.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT berlin_date, first_event, last_event, n_trades, low, high
        FROM days
        ORDER BY berlin_date DESC
        """
    ).fetchall()
    return [
        {
            "berlin_date": row["berlin_date"],
            "first_event": row["first_event"],
            "last_event": row["last_event"],
            "n_trades": row["n_trades"],
            "low": dec(row["low"]),
            "high": dec(row["high"]),
        }
        for row in rows
    ]


def list_trades(
    conn: psycopg.Connection,
    start: datetime,
    end: datetime,
    *,
    after_time: datetime | None = None,
    after_id: int = 0,
    limit: int = 200_000,
) -> list[dict]:
    sql = """
        SELECT id, event_time, price, quantity, contract_date, venue,
               external_id, notional
        FROM trades
        WHERE event_time >= %s AND event_time < %s
    """
    params: list[object] = [start, end]
    if after_time is not None:
        sql += " AND (event_time, id) > (%s, %s)"
        params.extend([after_time, after_id])
    sql += " ORDER BY event_time ASC, id ASC LIMIT %s"
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [
        {
            "id": row["id"],
            "event_time": row["event_time"],
            "price": dec(row["price"]),
            "quantity": dec(row["quantity"]),
            "contract_date": row["contract_date"],
            "venue": row["venue"],
            "external_id": row["external_id"],
            "notional": dec(row["notional"]),
        }
        for row in rows
    ]


def summarize(conn: psycopg.Connection, start: datetime, end: datetime) -> dict:
    row = conn.execute(
        """
        SELECT
            count(*)::int AS n_trades,
            min(price) AS low,
            max(price) AS high,
            coalesce(sum(quantity), 0) AS volume,
            (array_agg(price ORDER BY event_time ASC, id ASC))[1] AS open,
            (array_agg(price ORDER BY event_time DESC, id DESC))[1] AS close
        FROM trades
        WHERE event_time >= %s AND event_time < %s
        """,
        (start, end),
    ).fetchone()
    assert row is not None
    return {
        "n_trades": row["n_trades"],
        "low": dec(row["low"]),
        "high": dec(row["high"]),
        "volume": float(row["volume"] or 0),
        "open": dec(row["open"]),
        "close": dec(row["close"]),
    }


def day_exists(conn: psycopg.Connection, day: date) -> bool:
    row = conn.execute(
        "SELECT 1 FROM days WHERE berlin_date = %s",
        (day,),
    ).fetchone()
    return row is not None
