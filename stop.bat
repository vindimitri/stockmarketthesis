@echo off
cd /d "%~dp0"
title FDAX Delayed Desk stoppen
echo Stoppe Datenbank, API und Website...
docker compose down
if errorlevel 1 (
  echo Stoppen fehlgeschlagen. Laeuft Docker Desktop?
  pause
  exit /b 1
)
echo Gestoppt. Die gespeicherten Daten bleiben erhalten.
timeout /t 3 /nobreak >nul
exit /b 0
