@echo off
setlocal EnableExtensions
title TamaRagna
cd /d "%~dp0"

echo.
echo   TamaRagna - raise a Ragnarok monster
echo   -----------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [X] Node.js 20 or newer is required.
  echo       Download it from https://nodejs.org and run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo   [X] Node.js 20 or newer is required. Found:
  node --version
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if not errorlevel 1 (
  echo   TamaRagna is already running. Opening it in your browser...
  if not "%TAMARAGNA_NO_BROWSER%"=="1" start "" "http://localhost:3000"
  ping -n 3 127.0.0.1 >nul 2>&1
  exit /b 0
)

if not exist "node_modules\next\package.json" (
  echo   [1/3] Installing dependencies. This only happens once...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :failed
) else (
  echo   [1/3] Dependencies ready.
)

if not exist ".next\BUILD_ID" goto :build
if not exist "data\generated\species.json" goto :build
echo   [2/3] Build ready.
goto :start

:build
echo   [2/3] Building the game. This only happens once...
call npm run build
if errorlevel 1 goto :failed

:start
echo   [3/3] Starting the server at http://localhost:3000
call npm run db:unlock >nul 2>&1
echo.
if "%TAMARAGNA_NO_BROWSER%"=="1" goto :skipbrowser
start "" /b powershell -NoProfile -ExecutionPolicy Bypass -Command "$url='http://localhost:3000'; for($i=0;$i -lt 240;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if($r.StatusCode -ge 200){ Start-Process $url; break } } catch {}; Start-Sleep -Milliseconds 1500 }"
:skipbrowser

echo   Close this window to stop the game.
echo.
call npm start
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo   [!] Something went wrong. The messages above should explain why.
echo       If the data download failed, check your internet connection and try again.
echo.
pause
exit /b 1
