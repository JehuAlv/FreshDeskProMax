@echo off
setlocal enabledelayedexpansion
title Freshdesk Dashboard - Starting...

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

:: Start proxy with auto-restart watchdog (hidden window)
wscript "%DIR%\watchdog.vbs"

:: Wait for proxy to be ready
timeout /t 5 /nobreak >nul

echo ============================================
echo   Freshdesk Dashboard - Server Running
echo ============================================
echo.
echo   Dashboard URL:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    if not "!ip!"=="" echo   http://!ip!:8080
)
echo.
echo   Proxy:  port 8080  (auto-restart enabled)
echo   Ollama: port 11434
echo.
echo   Services are running in the background.
echo   You can close this window.
echo.
