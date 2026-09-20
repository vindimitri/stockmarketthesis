#!/usr/bin/env bash
set -u
cd /opt/stockmarketthesis

echo
echo " FDAX Delayed Desk"
echo " Starte vorhandene Datenbank, Ingest, API und Website..."
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

echo "Warte auf die GUI..."
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    ip="$(curl -s --max-time 3 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
    echo
    echo " Bereit: http://${ip:-localhost}:8080"
    echo " Stoppen: ./stop.sh"
    echo
    exit 0
  fi
  sleep 2
done

echo "Die GUI antwortet nicht. Pruefe: docker compose ps"
exit 1
