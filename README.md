# FDAX Delayed Desk

Private Testumgebung: Eurex-FDAX-Trades aus den kostenlosen **15-Minuten-Delayed-Dateien** der Deutschen Boerse laden und Tage speichern.

Kein offizieller DAX-Index. Nutzung nur privat, ohne Weitergabe.

## Projektstruktur

```
stockmarketthesis/
├── api/                 FastAPI (Trades, Days, Health)
├── ingest/              MFS-Downloader + Parser → Postgres
├── web/                 React Desk-UI (Vite)
│   ├── public/          Live-Assets (Logo, Audio, Icons)
│   └── src/
│       ├── components/  UI + Charts
│       ├── hooks/       Daten-/View-Hooks
│       └── lib/         API-Client, Format, Tape, KO-Sim
├── db/                  Schema (init.sql)
├── data/                Laufzeitdaten (gitignore)
│   ├── raw/             Rohdateien vom Ingest
│   ├── postgres/        DB-Volume
│   └── dumps/           SQL-Backups
├── assets/archive/      Original-Medien / Entwürfe (nicht live)
├── scripts/             start/stop Helper
├── docker-compose.yml
├── start.bat / start.sh Ein-Klick-Start
└── stop.bat  / stop.sh  Stoppen
```

## Was die Boerse wirklich liefert

- Listing: `https://mfs.deutsche-boerse.com/api/DEUR-posttrade`
- Download: `https://mfs.deutsche-boerse.com/api/download/<dateiname>`
- **Eine Datei pro Minute** (UTC im Namen), plus eine **daily**-Datei vom Vortag
- Inhalt: NDJSON, ein Post-Trade-Record je Zeile
- Zeitstempel: `tradingDateAndTime` in UTC, oft Nanosekunden
- FDAX-ISIN: `DE0009652388`
- Records ohne `price` (Pending) werden verworfen

Die HTML-Seite verlangt "I agree". Die JSON-API ist erreichbar; die Terms of Use der Delayed Data gelten trotzdem.

## Schnellstart

```bash
# Windows
start.bat

# Linux / Server
./start.sh
```

Oder manuell:

```bash
docker compose up -d --build
```

GUI: http://localhost:8080 · API-Docs: http://localhost:8001/docs

Stoppen: `stop.bat` / `./stop.sh`

## Lokal entwickeln

### Ingest

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

Fenster 17:00-18:00 Europe/Berlin:

```bash
set DATABASE_URL=postgresql://fdax:fdax@localhost:5433/fdax
python -m fdax_ingest ingest-range --start 2026-09-17T17:00 --end 2026-09-17T18:00
```

Oder der ganze Vortag (eine Datei, ~18 MB gz):

```bash
python -m fdax_ingest ingest-daily --date 2026-09-16
```

Rohdateien liegen unter `data/raw/` (nicht committen). Die Boerse rate-limitet (HTTP 429); der Ingest wartet und setzt bei vorhandenen Dateien fort.

### API

```bash
docker compose up -d db api
# oder lokal:
cd api
pip install -e ".[dev]"
set DATABASE_URL=postgresql://fdax:fdax@localhost:5433/fdax
python -m fdax_api
```

- http://localhost:8001/docs
- http://localhost:8001/health
- http://localhost:8001/days
- http://localhost:8001/trades?date=2026-09-17

### GUI

```bash
cd web
npm install
npm run dev
```

http://localhost:5173 — Vite proxied `/days`, `/summary`, `/trades`, `/health` zur API auf Port 8001.
