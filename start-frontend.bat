@echo off
title Billiard Hall Frontend :5173
cd /d "%~dp0frontend"
echo Starting frontend on http://localhost:5173 ...
npm run dev
echo.
echo [Frontend exited - press any key to close]
pause
