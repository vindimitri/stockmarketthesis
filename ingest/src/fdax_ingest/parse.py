from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fdax_ingest.hours import in_desk_session


def parse_trading_time(value: str) -> datetime:
    """Parse MiFID UTC timestamps that may carry nanoseconds."""
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    if "." not in raw:
        return datetime.fromisoformat(raw)
    head, tail = raw.split(".", 1)
    digits = []
    tz = "+00:00"
    for i, ch in enumerate(tail):
        if ch.isdigit():
            digits.append(ch)
        else:
            tz = tail[i:]
            break
    frac = "".join(digits)
    frac = (frac + "000000")[:6]
    parsed = datetime.fromisoformat(f"{head}.{frac}{tz}")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def keep_trade(record: dict[str, Any], isin: str) -> bool:
    if record.get("messageId") != "posttrade":
        return False
    if record.get("instrumentIdentificationCode") != isin:
        return False
    if "price" not in record or record["price"] is None:
        return False
    if "quantity" not in record:
        return False
    if not record.get("transactionIdentificationCode"):
        return False
    if not record.get("tradingDateAndTime"):
        return False
    return in_desk_session(parse_trading_time(record["tradingDateAndTime"]))


def normalize_trade(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "external_id": record["transactionIdentificationCode"],
        "isin": record["instrumentIdentificationCode"],
        "contract_date": record["contractDate"],
        "venue": record.get("venueOfExecution") or "XEUR",
        "event_time": parse_trading_time(record["tradingDateAndTime"]),
        "published_at": (
            parse_trading_time(record["publicationDateAndTime"])
            if record.get("publicationDateAndTime")
            else None
        ),
        "price": record["price"],
        "quantity": record["quantity"],
        "notional": record.get("notionalAmount"),
        "price_currency": record.get("priceCurrency") or "EUR",
    }
