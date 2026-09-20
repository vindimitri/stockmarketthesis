#!/usr/bin/env bash
set -u
cd /opt/stockmarketthesis

echo
echo " FDAX Delayed Desk"
echo " Starte Stack und lade alle verfuegbaren Tage..."
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker ist nicht installiert."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker laeuft nicht."
  exit 1
fi

docker compose up -d --build || {
  echo "docker compose up ist fehlgeschlagen."
  exit 1
}

echo "Warte auf die API..."
ready=0
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  echo "API antwortet nicht. Pruefe: docker compose ps"
  exit 1
fi

echo "Frage die Boerse nach Daily-Dateien..."
probe_json="$(docker compose run --rm ingest probe)"
days="$(printf '%s\n' "$probe_json" | grep -oE 'daily-[0-9]{4}-[0-9]{2}-[0-9]{2}' | sed 's/daily-//' | sort -u)"
stored="$(curl -s http://127.0.0.1:8080/days | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort -u || true)"

if [ -z "$days" ]; then
  echo "Keine Daily-Dateien in der Boerse-Liste."
else
  echo "Verfuegbar: $(printf '%s ' $days)"
  for day in $days; do
    if printf '%s\n' "$stored" | grep -qx "$day"; then
      echo "Skip $day (schon in der DB)"
      continue
    fi
    echo "Lade $day ..."
    docker compose run --rm ingest ingest-daily --date "$day" || echo "Fehler bei $day"
  done
fi

ip="$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo
echo " Bereit: http://${ip:-localhost}:8080"
echo " Stoppen: ./stop.sh"
echo
