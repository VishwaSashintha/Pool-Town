@echo off
setlocal enabledelayedexpansion

echo [1/5] Building frontend...
cd /d "%~dp0..\frontend"
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    exit /b %errorlevel%
)

echo [2/5] Compiling C# launcher...
cd /d "%~dp0"
"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /target:winexe /win32icon:"icon.ico" /out:"launcher\PoolTownERP.exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll "launcher\Program.cs"
if %errorlevel% neq 0 (
    echo Launcher compilation failed!
    exit /b %errorlevel%
)

echo [3/5] Packaging backend with PyInstaller...
cd /d "%~dp0..\backend"
pyinstaller backend.spec --noconfirm
if %errorlevel% neq 0 (
    echo Backend packaging failed!
    exit /b %errorlevel%
)

echo [4/5] Copying frontend assets into backend distribution...
xcopy /s /e /y /i "%~dp0..\frontend\dist\*" "%~dp0..\backend\dist\PoolTownBackend\frontend_dist\"

echo [5/5] Compiling Inno Setup installer...
cd /d "%~dp0"
if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Inno Setup 6\ISCC.exe" (
    "C:\Users\%USERNAME%\AppData\Local\Programs\Inno Setup 6\ISCC.exe" "PoolTownERP.iss"
) else if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "PoolTownERP.iss"
) else (
    echo Inno Setup ISCC.exe not found!
    exit /b 1
)

if %errorlevel% equ 0 (
    echo.
    echo BUILD SUCCESSFUL!
    echo Installer created at: installer\output\PoolTownERP-Setup.exe
)

