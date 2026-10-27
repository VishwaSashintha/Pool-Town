@echo off
title Billiard Hall Backend :8000
cd /d "%~dp0backend"
echo Starting backend on http://127.0.0.1:8000 ...
uvicorn app.main:app --host 127.0.0.1 --port 8000
echo.
echo [Backend exited - press any key to close]
pause
