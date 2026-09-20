from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


def dec(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


class IngestRunSummary(BaseModel):
    id: int
    status: str
    source: str | None = None
    started_at: str | None = None
    finished_at: str | None = None
    records_seen: int | None = None
    records_kept: int | None = None
    records_upserted: int | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    ok: bool
    database: str
    timezone: str
    tape_delay_seconds: int = 900
    last_ingest: IngestRunSummary | None = None


class DayRow(BaseModel):
    berlin_date: date
    first_event: datetime
    last_event: datetime
    n_trades: int
    low: float
    high: float


class TradeRow(BaseModel):
    id: int
    event_time: datetime
    price: float
    quantity: float
    contract_date: date
    venue: str
    external_id: str
    notional: float | None = None


class TradeListResponse(BaseModel):
    date: date
    start: datetime
    end: datetime
    timezone: str
    count: int
    trades: list[TradeRow]


class SummaryResponse(BaseModel):
    date: date
    start: datetime
    end: datetime
    timezone: str
    n_trades: int
    open: float | None = None
    close: float | None = None
    low: float | None = None
    high: float | None = None
    volume: float = Field(description="Sum of contract quantity")
