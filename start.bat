@echo off
title Billiard Hall Management & Accounting System
echo ======================================================================
echo    Billiard Hall Management and Accounting System
echo    Owners: Akash, Pasan, Vishwa
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking dependencies...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH! Please install Python 3.11+.
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm is not installed or not in PATH! Please install Node 18+.
    pause
    exit /b 1
)

echo [2/3] Starting backend FastAPI service on port 8000...
start "Billiard Hall Backend (:8000)" cmd /k "cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo [3/3] Starting frontend Vite service on port 5173...
start "Billiard Hall Frontend (:5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ======================================================================
echo    System is launching!
echo    Frontend URL: http://localhost:5173
echo    Backend API:  http://localhost:8000/docs
echo ======================================================================
echo.
timeout /t 3 >nul
start http://localhost:5173
