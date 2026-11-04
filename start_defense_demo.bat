@echo off
title KSYN FitConnect - Defense Mode
echo ========================================================
echo   KSYN FitConnect Enterprise Platform - Defense Launcher
echo ========================================================
echo.
echo [Step 1/3] Building React client for production...
call npm run build
echo.
echo [Step 2/3] Launching Express Unified Server (Port 5080)...
start "KSYN FitConnect Server" cmd /k "node server/server.js"
echo.
echo [Step 3/3] Opening Instant HTTPS Tunnel for Mobile QR Camera Scanning...
echo (Share the https://... link with panelists to test on their phones)
echo ========================================================
echo.
call npx --yes localtunnel --port 5080
pause
