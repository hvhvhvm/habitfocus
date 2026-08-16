@echo off
title Lock-In Protocol — Frontend (Dev)
color 0B
echo.
echo  ==========================================
echo   LOCK-IN PROTOCOL — Frontend Dev Server
echo  ==========================================
echo.
echo  Starting Vite dev server...
echo  Open http://localhost:5173 in your browser.
echo.
echo  Keep this window OPEN while developing.
echo  Press Ctrl+C to stop.
echo.

cd /d "%~dp0"
npm run dev

pause
