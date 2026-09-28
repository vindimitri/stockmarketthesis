#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."

echo "Stoppe und loesche die Container..."
docker compose down || {
  echo "Stoppen fehlgeschlagen. Laeuft Docker?"
  exit 1
}
echo "Container sind weg. Daten unter data/ bleiben erhalten."
