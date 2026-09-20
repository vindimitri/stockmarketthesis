from __future__ import annotations

import gzip
import io
import json
import re
import time
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any

import httpx

MINUTE_FILE_RE = re.compile(
    r"^(?P<prefix>.+)-(?P<date>\d{4}-\d{2}-\d{2})T(?P<hh>\d{2})_(?P<mm>\d{2})\.json\.gz$"
)
DAILY_FILE_RE = re.compile(
    r"^(?P<prefix>.+)-daily-(?P<date>\d{4}-\d{2}-\d{2})\.json\.gz$"
)


class MfsClient:
    def __init__(self, base_url: str, source_prefix: str, user_agent: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.source_prefix = source_prefix
        self._client = httpx.Client(
            base_url=self.base_url,
            headers={"User-Agent": user_agent},
            follow_redirects=True,
            timeout=httpx.Timeout(120.0, connect=15.0),
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> MfsClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def list_files(self) -> dict[str, Any]:
        response = self._client.get(f"/api/{self.source_prefix}")
        response.raise_for_status()
        return response.json()

    def download(self, filename: str) -> bytes:
        # Signed GCS URLs expire in ~2s. Always start from MFS, never HEAD first.
        last_error: Exception | None = None
        for attempt in range(8):
            try:
                response = self._client.get(f"/api/download/{filename}")
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after and retry_after.isdigit() else min(20.0, 1.5 * (2**attempt))
                    time.sleep(wait)
                    continue
                response.raise_for_status()
                return response.content
            except httpx.HTTPError as exc:
                last_error = exc
                time.sleep(min(20.0, 0.6 * (2**attempt)))
        assert last_error is not None
        raise last_error


def iter_ndjson(payload: bytes) -> Iterator[dict[str, Any]]:
    if not payload:
        return
    raw = gzip.decompress(payload) if payload[:2] == b"\x1f\x8b" else payload
    if not raw:
        return
    with io.TextIOWrapper(io.BytesIO(raw), encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def parse_minute_filename(filename: str) -> datetime | None:
    match = MINUTE_FILE_RE.match(filename)
    if not match:
        return None
    return datetime(
        int(match.group("date")[0:4]),
        int(match.group("date")[5:7]),
        int(match.group("date")[8:10]),
        int(match.group("hh")),
        int(match.group("mm")),
        tzinfo=timezone.utc,
    )


def is_daily_filename(filename: str) -> bool:
    return DAILY_FILE_RE.match(filename) is not None


def parse_daily_date(filename: str) -> str | None:
    match = DAILY_FILE_RE.match(filename)
    return match.group("date") if match else None
