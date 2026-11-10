@echo off
rem Start DriftGuard for local development: backend API + frontend dev server.
rem Backend runs on http://127.0.0.1:8000, dashboard (Vite, hot reload) on
rem http://127.0.0.1:5173. Uses a local SQLite file, never the database in .env.

setlocal
cd /d "%~dp0"

set "API_PORT=8000"
set "WEB_PORT=5173"
set "API_URL=http://127.0.0.1:%API_PORT%"
set "WEB_URL=http://127.0.0.1:%WEB_PORT%"
set "DATABASE_URL=sqlite:///./driftguard-local.db"
set "PYTHONUTF8=1"

rem --- 1. Python environment -----------------------------------------------
if not exist ".venv\Scripts\python.exe" (
    echo Creating the Python environment ^(first run only^)...
    python -m venv .venv || goto :fail
    ".venv\Scripts\python.exe" -m pip install -e ".[server]" || goto :fail
)

rem --- 2. Frontend dependencies --------------------------------------------
if not exist "frontend\node_modules" (
    echo Installing the dashboard dependencies ^(first run only^)...
    pushd frontend
    call npm ci || (popd & goto :fail)
    popd
)

rem --- 3. Backend server ----------------------------------------------------
curl -s -o nul "%API_URL%/health"
if errorlevel 1 (
    echo Starting the DriftGuard API on %API_URL% ...
    start "DriftGuard server" ".venv\Scripts\driftguard-server.exe" --port %API_PORT%
) else (
    echo A DriftGuard server is already running on port %API_PORT%.
)

echo Waiting for the server...
set /a TRIES=0
:wait
curl -s -o nul "%API_URL%/health"
if not errorlevel 1 goto :ready
set /a TRIES+=1
if %TRIES% geq 30 (
    echo The server did not start. Check the "DriftGuard server" window.
    goto :fail
)
timeout /t 1 /nobreak >nul
goto :wait

:ready
rem --- 4. Frontend dev server ----------------------------------------------
echo.
echo API:       %API_URL%
echo Dashboard: %WEB_URL%
echo.
start "" "%WEB_URL%"

pushd frontend
call npm run dev -- --port %WEB_PORT%
popd

echo.
echo The API keeps running in its own window. Close that window to stop it.
pause
exit /b 0

:fail
echo.
echo Startup failed. See the messages above.
pause
exit /b 1
