CREATE TABLE ingest_runs (
    id              bigserial PRIMARY KEY,
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,
    status          text NOT NULL CHECK (status IN ('running', 'ok', 'error')),
    source          text NOT NULL,
    source_files    text[] NOT NULL DEFAULT '{}',
    records_seen    integer NOT NULL DEFAULT 0,
    records_kept    integer NOT NULL DEFAULT 0,
    records_upserted integer NOT NULL DEFAULT 0,
    error           text
);

CREATE TABLE trades (
    id              bigserial PRIMARY KEY,
    external_id     text NOT NULL UNIQUE,
    isin            text NOT NULL,
    contract_date   date NOT NULL,
    venue           text NOT NULL,
    event_time      timestamptz NOT NULL,
    published_at    timestamptz,
    price           numeric(12, 4) NOT NULL,
    quantity        numeric(18, 4) NOT NULL,
    notional        numeric(20, 4),
    price_currency  text NOT NULL DEFAULT 'EUR',
    ingest_run_id   bigint REFERENCES ingest_runs (id)
);

CREATE INDEX trades_event_time_idx ON trades (event_time);
CREATE INDEX trades_contract_date_idx ON trades (contract_date);
CREATE INDEX trades_berlin_day_idx
    ON trades (((event_time AT TIME ZONE 'Europe/Berlin')::date));

CREATE TABLE ingested_files (
    filename          text PRIMARY KEY,
    sha256            text,
    ingested_at       timestamptz NOT NULL DEFAULT now(),
    records_upserted  integer NOT NULL DEFAULT 0
);

CREATE VIEW days AS
SELECT
    (event_time AT TIME ZONE 'Europe/Berlin')::date AS berlin_date,
    min(event_time) AS first_event,
    max(event_time) AS last_event,
    count(*)::integer AS n_trades,
    min(price) AS low,
    max(price) AS high
FROM trades
GROUP BY 1;
