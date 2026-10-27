@echo off
setlocal enabledelayedexpansion
title Billiard Hall Management System - Launcher

echo ======================================================================
echo          Billiard Hall Management System - System Startup
echo ======================================================================
echo.

:: 1. Ensure working directory is project root
cd /d "%~dp0"

:: 2. Verify required project directories exist
if not exist "%~dp0backend" (
    echo [ERROR] Backend directory not found: "%~dp0backend"
    echo Please make sure start.bat is located in the project root folder.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0frontend" (
    echo [ERROR] Frontend directory not found: "%~dp0frontend"
    echo Please make sure start.bat is located in the project root folder.
    echo.
    pause
    exit /b 1
)

:: 3. Verify existing separate startup scripts exist
if not exist "%~dp0start-backend.bat" (
    echo [ERROR] start-backend.bat not found in "%~dp0"
    echo Please ensure start-backend.bat is present.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0start-frontend.bat" (
    echo [ERROR] start-frontend.bat not found in "%~dp0"
    echo Please ensure start-frontend.bat is present.
    echo.
    pause
    exit /b 1
)

:: 4. Check for virtual environments and Python/Uvicorn availability
set "VENV_DIR="
if exist "%~dp0backend\.venv\Scripts\uvicorn.exe" (
    set "VENV_DIR=%~dp0backend\.venv"
) else if exist "%~dp0backend\venv\Scripts\uvicorn.exe" (
    set "VENV_DIR=%~dp0backend\venv"
) else if exist "%~dp0.venv\Scripts\uvicorn.exe" (
    set "VENV_DIR=%~dp0.venv"
) else if exist "%~dp0venv\Scripts\uvicorn.exe" (
    set "VENV_DIR=%~dp0venv"
)

if defined VENV_DIR (
    echo [OK] Virtual environment detected: "!VENV_DIR!"
    set "PATH=!VENV_DIR!\Scripts;!PATH!"
) else (
    where uvicorn >nul 2>&1
    if !errorlevel! neq 0 (
        where python >nul 2>&1
        if !errorlevel! neq 0 (
            echo [ERROR] Python / Uvicorn was not found in PATH or in a virtual environment.
            echo Please ensure Python and required dependencies from requirements.txt are installed.
            echo.
            pause
            exit /b 1
        )
    )
)

:: 5. Check for Node.js / npm availability
where npm >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] npm command was not found in PATH.
    echo Please ensure Node.js and npm are installed to run the frontend.
    echo.
    pause
    exit /b 1
)

:: 6. Check if backend or frontend are already running (Duplicate Prevention)
set "BACKEND_ALREADY_RUNNING=0"
netstat -ano | findstr /C:":8000 " | findstr /I "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    set "BACKEND_ALREADY_RUNNING=1"
    echo [INFO] Backend is already running on port 8000. Skipping duplicate startup.
)

set "FRONTEND_ALREADY_RUNNING=0"
netstat -ano | findstr /C:":5173 " | findstr /I "LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    set "FRONTEND_ALREADY_RUNNING=1"
    echo [INFO] Frontend is already running on port 5173. Skipping duplicate startup.
)

:: 7. Launch services in separate command windows if not already running
if !BACKEND_ALREADY_RUNNING! equ 0 (
    echo Starting Backend in a separate window on port 8000...
    start "Billiard Hall Backend :8000" "%~dp0start-backend.bat"
)

if !FRONTEND_ALREADY_RUNNING! equ 0 (
    echo Starting Frontend in a separate window on port 5173...
    start "Billiard Hall Frontend :5173" "%~dp0start-frontend.bat"
)

:: 8. Readiness check before opening browser
echo.
echo Verifying service readiness...

set "HAS_CURL=0"
where curl >nul 2>&1
if !errorlevel! equ 0 set "HAS_CURL=1"

set "BACKEND_READY=0"
echo - Waiting for Backend on http://127.0.0.1:8000/health ...
for /L %%i in (1,1,30) do (
    if !BACKEND_READY! equ 0 (
        if !HAS_CURL! equ 1 (
            curl.exe -s -f -m 2 -o nul "http://127.0.0.1:8000/health" >nul 2>&1
            if !errorlevel! equ 0 set "BACKEND_READY=1"
        ) else (
            netstat -ano | findstr /C:":8000 " | findstr /I "LISTENING" >nul 2>&1
            if !errorlevel! equ 0 set "BACKEND_READY=1"
        )
        if !BACKEND_READY! equ 0 (
            ping 127.0.0.1 -n 2 >nul
        )
    )
)

if !BACKEND_READY! equ 1 (
    echo   [OK] Backend is ready.
) else (
    echo   [WARNING] Backend health check timed out. Check the backend window for error messages.
)

set "FRONTEND_READY=0"
echo - Waiting for Frontend on http://localhost:5173 ...
for /L %%i in (1,1,30) do (
    if !FRONTEND_READY! equ 0 (
        if !HAS_CURL! equ 1 (
            curl.exe -s -f -m 2 -o nul "http://localhost:5173" >nul 2>&1
            if !errorlevel! equ 0 set "FRONTEND_READY=1"
        ) else (
            netstat -ano | findstr /C:":5173 " | findstr /I "LISTENING" >nul 2>&1
            if !errorlevel! equ 0 set "FRONTEND_READY=1"
        )
        if !FRONTEND_READY! equ 0 (
            ping 127.0.0.1 -n 2 >nul
        )
    )
)

if !FRONTEND_READY! equ 1 (
    echo   [OK] Frontend is ready.
) else (
    echo   [WARNING] Frontend check timed out. Check the frontend window for error messages.
)

:: 9. Check readiness status
if !BACKEND_READY! equ 0 (
    echo.
    echo ======================================================================
    echo [ERROR] Backend did not respond on http://127.0.0.1:8000.
    echo Please inspect the backend console window for error messages.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

if !FRONTEND_READY! equ 0 (
    echo.
    echo ======================================================================
    echo [ERROR] Frontend did not respond on http://localhost:5173.
    echo Please inspect the frontend console window for error messages.
    echo ======================================================================
    echo.
    pause
    exit /b 1
)

:: 10. Open browser
echo.
echo Opening http://localhost:5173 in your default browser...
start "" "http://localhost:5173"

echo.
echo ======================================================================
echo Billiard Hall Management System is running!
echo   * Backend:  http://127.0.0.1:8000  (Docs: http://127.0.0.1:8000/docs)
echo   * Frontend: http://localhost:5173
echo.
echo The backend and frontend are running in their own separate windows.
echo Keep those windows open while using the application.
echo This launcher window will close automatically in 5 seconds.
echo ======================================================================
echo.

ping 127.0.0.1 -n 6 >nul
exit /b 0
