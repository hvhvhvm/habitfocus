@echo off
title Lock-In Protocol — Backend Server
color 0A
echo.
echo  ==========================================
echo   LOCK-IN PROTOCOL — Backend + Scheduler
echo  ==========================================
echo.
echo  Starting FastAPI backend on http://localhost:8000
echo  Push notification scheduler is active.
echo  Notifications fire automatically at:
echo    07:00 AM  ^> Morning Lock-In
echo    12:30 PM  ^> Afternoon Momentum
echo    05:30 PM  ^> Evening Surge
echo    09:30 PM  ^> Night Protocol
echo.
echo  Keep this window OPEN for notifications to work.
echo  Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause
