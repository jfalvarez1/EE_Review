@echo off
title EE Learning Platform Launcher
set "DETACHED=0"
if /I "%~1"=="--detached" set "DETACHED=1"

echo ========================================
echo    EE Learning Platform Launcher
echo ========================================
echo.
echo Starting local web server...
echo.

REM Change to the directory where this batch file is located
cd /d "%~dp0"

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using Python HTTP server on port 8080...
    echo.
    echo Opening browser to: http://localhost:8080
    echo.
    if "%DETACHED%"=="1" (
        echo Running in detached mode. A new window will host the server.
    ) else (
        echo Press Ctrl+C to stop the server when done.
    )
    echo ========================================
    REM Small delay without requiring stdin (works in non-interactive shells)
    ping -n 3 127.0.0.1 >nul
    start http://localhost:8080
    if "%DETACHED%"=="1" (
        REM Detached mode: spawn server and exit immediately (no stdin required).
        powershell -NoProfile -Command "Start-Process -FilePath python -ArgumentList '-m','http.server','8080' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
        goto :eof
    )
    python -m http.server 8080
) else (
    REM Fallback: just open the index.html directly
    echo Python not found - opening directly in browser...
    echo Note: Some features may not work when opened directly.
    echo For best results, install Python and run this script again.
    echo.
    start "" "index.html"
)

if "%DETACHED%"=="0" pause
