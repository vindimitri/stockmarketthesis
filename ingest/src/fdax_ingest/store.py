from __future__ import annotations

from datetime import datetime
from typing import Any

import psycopg

UPSERT_SQL = """
INSERT INTO trades (
    external_id, isin, contract_date, venue, event_time, published_at,
    price, quantity, notional, price_currency, ingest_run_id
) VALUES (
    %(external_id)s, %(isin)s, %(contract_date)s, %(venue)s, %(event_time)s,
    %(published_at)s, %(price)s, %(quantity)s, %(notional)s, %(price_currency)s,
    %(ingest_run_id)s
)
ON CONFLICT (external_id) DO NOTHING
"""


class TradeStore:
    def __init__(self, database_url: str) -> None:
        self._conn = psycopg.connect(database_url, autocommit=False)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> TradeStore:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def ensure_schema(self) -> None:
        """Fallback for DBs that predate ingested_files. Canonical DDL: db/init.sql."""
        with self._conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ingested_files (
                    filename          text PRIMARY KEY,
                    sha256            text,
                    ingested_at       timestamptz NOT NULL DEFAULT now(),
                    records_upserted  integer NOT NULL DEFAULT 0
                )
                """
            )
        self._conn.commit()

    def stored_berlin_dates(self) -> set[str]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT berlin_date::text FROM days")
            rows = cur.fetchall()
        return {str(row[0]) for row in rows}

    def ingested_filenames(self) -> set[str]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT filename FROM ingested_files")
            rows = cur.fetchall()
        return {str(row[0]) for row in rows}

    def max_event_time(self) -> datetime | None:
        with self._conn.cursor() as cur:
            cur.execute("SELECT max(event_time) FROM trades")
            row = cur.fetchone()
        if not row or row[0] is None:
            return None
        return row[0]

    def mark_ingested(self, filename: str, sha256: str, records_upserted: int) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ingested_files (filename, sha256, records_upserted)
                VALUES (%s, %s, %s)
                ON CONFLICT (filename) DO UPDATE
                SET sha256 = EXCLUDED.sha256,
                    ingested_at = now(),
                    records_upserted = EXCLUDED.records_upserted
                """,
                (filename, sha256, records_upserted),
            )
        self._conn.commit()

    def start_run(self, source: str, source_files: list[str]) -> int:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ingest_runs (status, source, source_files)
                VALUES ('running', %s, %s)
                RETURNING id
                """,
                (source, source_files),
            )
            run_id = cur.fetchone()[0]
        self._conn.commit()
        return int(run_id)

    def finish_run(
        self,
        run_id: int,
        *,
        status: str,
        records_seen: int,
        records_kept: int,
        records_upserted: int,
        error: str | None = None,
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ingest_runs
                SET finished_at = now(),
                    status = %s,
                    records_seen = %s,
                    records_kept = %s,
                    records_upserted = %s,
                    error = %s
                WHERE id = %s
                """,
                (status, records_seen, records_kept, records_upserted, error, run_id),
            )
        self._conn.commit()

    def upsert_trades_counted(self, run_id: int, trades: list[dict[str, Any]]) -> int:
        if not trades:
            return 0
        inserted = 0
        with self._conn.cursor() as cur:
            for trade in trades:
                payload = dict(trade)
                payload["ingest_run_id"] = run_id
                cur.execute(UPSERT_SQL, payload)
                if cur.rowcount == 1:
                    inserted += 1
        self._conn.commit()
        return inserted
