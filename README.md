# FDAX Delayed Desk

Private Testumgebung: Eurex-FDAX-Trades aus den kostenlosen **15-Minuten-Delayed-Dateien** der Deutschen Boerse laden und Tage speichern.

Kein offizieller DAX-Index. Nutzung nur privat, ohne Weitergabe.

## Was die Boerse wirklich liefert

- Listing: `https://mfs.deutsche-boerse.com/api/DEUR-posttrade`
- Download: `https://mfs.deutsche-boerse.com/api/download/<dateiname>`
- **Eine Datei pro Minute** (UTC im Namen), plus eine **daily**-Datei vom Vortag
- Inhalt: NDJSON, ein Post-Trade-Record je Zeile
- Zeitstempel: `tradingDateAndTime` in UTC, oft Nanosekunden
- FDAX-ISIN: `DE0009652388`
- Records ohne `price` (Pending) werden verworfen

Die HTML-Seite verlangt "I agree". Die JSON-API ist erreichbar; die Terms of Use der Delayed Data gelten trotzdem.

## Lokal starten

```bash
docker compose up -d db
cd ingest
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
```

Probe ohne Datenbank:

```bash
python -m fdax_ingest probe
```

Fenster 17:00-18:00 Europe/Berlin (heute anpassen):

```bash
set DATABASE_URL=postgresql://fdax:fdax@localhost:5433/fdax
python -m fdax_ingest ingest-range --start 2026-09-17T17:00 --end 2026-09-17T18:00
```

Oder der ganze Vortag (eine Datei, ~18 MB gz):

```bash
python -m fdax_ingest ingest-daily --date 2026-09-16
```

Docker:

```bash
docker compose --profile ingest run --rm ingest probe
docker compose --profile ingest run --rm ingest ingest-range --start 2026-09-17T17:00 --end 2026-09-17T18:00
```

Rohdateien liegen unter `data/raw/` (nicht committen).

Die Boerse rate-limitet (HTTP 429), wenn zu schnell geladen wird. Der Ingest wartet und setzt bei vorhandenen Dateien fort.

Postgres: Docker Desktop muss laufen, dann `docker compose up -d db`. Ohne Docker geht `--dry-run` (nur Dateien + Zaehlung).

## API (Schritt 3)

```bash
docker compose up -d db api
```

Oder lokal gegen die DB auf Port 5433:

```bash
cd api
pip install -e ".[dev]"
set DATABASE_URL=postgresql://fdax:fdax@localhost:5433/fdax
python -m fdax_api
```

Dann:

- http://localhost:8001/docs
- http://localhost:8001/health
- http://localhost:8001/days
- http://localhost:8001/summary?date=2026-09-17
- http://localhost:8001/trades?date=2026-09-17

## GUI (Schritt 4)

Vite + React, Lightweight Charts, Tailwind. Eine Seite: Tag wählen, Kennzahlen, 1-Sekunden-Kerzen 17:00-18:00 Berlin, Trades.

Lokal (API muss auf Port 8001 laufen):

```bash
cd web
npm install
npm run dev
```

Dann http://localhost:5173 — Vite proxied `/days`, `/summary`, `/trades`, `/health` zur API.

Oder alles in Docker, GUI auf Port 8080:

```bash
docker compose up -d db api web
```

