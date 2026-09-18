@echo off
setlocal
cd /d "%~dp0"
title FDAX Delayed Desk

echo.
echo  FDAX Delayed Desk
echo  Starte Docker, Backend und GUI...
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker ist nicht installiert. Bitte Docker Desktop einrichten.
  goto :fail
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop ist aus. Wird gestartet...
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
    start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  ) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
    start "" "%LocalAppData%\Docker\Docker Desktop.exe"
  ) else (
    echo Docker Desktop wurde nicht gefunden. Bitte manuell starten.
    goto :fail
  )
)

echo Warte auf Docker...
set /a n=0
:wait_docker
docker info >nul 2>&1
if not errorlevel 1 goto :docker_ready
set /a n+=1
if %n% geq 60 (
  echo Docker ist nach 3 Minuten nicht bereit.
  goto :fail
)
timeout /t 3 /nobreak >nul
goto :wait_docker

:docker_ready
echo Baue und starte Datenbank, Ingest, API und Website...
docker compose up -d --build
if errorlevel 1 (
  echo Docker-Compose-Start fehlgeschlagen.
  goto :fail
)

echo Warte auf die GUI...
set /a n=0
:wait_web
curl.exe -sf http://127.0.0.1:8080/health >nul 2>&1
if not errorlevel 1 goto :ready
set /a n+=1
if %n% geq 40 (
  echo Die GUI antwortet nicht. Pruefe: docker compose ps
  goto :fail
)
timeout /t 2 /nobreak >nul
goto :wait_web

:ready
echo.
echo  Bereit: http://localhost:8080
echo  Fenster kann geschlossen werden, die Dienste laufen weiter.
echo  Stoppen: stop.bat
echo.
start http://localhost:8080/?v=%RANDOM%
exit /b 0

:fail
echo.
pause
exit /b 1
