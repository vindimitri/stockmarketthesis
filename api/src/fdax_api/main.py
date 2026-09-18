from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg import Connection

from fdax_api.config import settings
from fdax_api.db import close_pool, get_conn, open_pool
from fdax_api import queries
from fdax_api.schemas import (
    DayRow,
    HealthResponse,
    SummaryResponse,
    TradeListResponse,
    TradeRow,
)
from fdax_api.timewin import berlin_window, parse_bound


@asynccontextmanager
async def lifespan(_app: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(
    title="FDAX Delayed API",
    description="Nur Lesen. Eurex FDAX, 15 Minuten delayed, privat.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "service": "fdax-api",
        "docs": "/docs",
        "health": "/health",
        "days": "/days",
    }


@app.get("/health", response_model=HealthResponse)
def health(conn: Connection = Depends(get_conn)) -> HealthResponse:
    try:
        queries.ping(conn)
        last = queries.last_ingest(conn)
        if last and last.get("finished_at"):
            last["finished_at"] = last["finished_at"].isoformat()
        if last and last.get("started_at"):
            last["started_at"] = last["started_at"].isoformat()
        return HealthResponse(
            ok=True,
            database="up",
            timezone=settings.tz,
            tape_delay_seconds=settings.tape_delay_seconds,
            last_ingest=last,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"database down: {exc}") from exc


@app.get("/days", response_model=list[DayRow])
def days(conn: Connection = Depends(get_conn)) -> list[DayRow]:
    return [DayRow.model_validate(row) for row in queries.list_days(conn)]


def _window(
    day: date,
    from_time: str,
    to_time: str,
    conn: Connection,
) -> tuple:
    if not queries.day_exists(conn, day):
        raise HTTPException(status_code=404, detail=f"Kein gespeicherter Tag {day.isoformat()}")
    start = parse_bound(from_time, field="from")
    end = parse_bound(to_time, field="to")
    return berlin_window(
        day,
        start.clock,
        end.clock,
        settings.tz,
        end_next_day=end.next_day,
    )


@app.get("/trades", response_model=TradeListResponse)
def trades(
    date: date = Query(..., description="Kalendertag Europe/Berlin"),
    from_time: str = Query(settings.default_from, alias="from"),
    to_time: str = Query(settings.default_to, alias="to"),
    after_time: datetime | None = Query(None),
    after_id: int = Query(0, ge=0),
    conn: Connection = Depends(get_conn),
) -> TradeListResponse:
    start, end = _window(date, from_time, to_time, conn)
    rows = queries.list_trades(conn, start, end, after_time=after_time, after_id=after_id)
    return TradeListResponse(
        date=date,
        start=start,
        end=end,
        timezone=settings.tz,
        count=len(rows),
        trades=[TradeRow.model_validate(row) for row in rows],
    )


@app.get("/summary", response_model=SummaryResponse)
def summary(
    date: date = Query(..., description="Kalendertag Europe/Berlin"),
    from_time: str = Query(settings.default_from, alias="from"),
    to_time: str = Query(settings.default_to, alias="to"),
    conn: Connection = Depends(get_conn),
) -> SummaryResponse:
    start, end = _window(date, from_time, to_time, conn)
    stats = queries.summarize(conn, start, end)
    return SummaryResponse(
        date=date,
        start=start,
        end=end,
        timezone=settings.tz,
        **stats,
    )


def run() -> None:
    import uvicorn

    uvicorn.run(
        "fdax_api.main:app",
        host="0.0.0.0",
        port=settings.api_port,
        reload=False,
    )
