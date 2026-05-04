@echo off
setlocal enabledelayedexpansion
title Freshdesk Dashboard - Starting...

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

:: Kill previous instances
taskkill /f /im ollama.exe >nul 2>&1
for /f "tokens=2" %%p in ('netstat -ano ^| findstr ":8080.*LISTENING" 2^>nul') do taskkill /f /pid %%p >nul 2>&1

:: Small delay for ports to clear
timeout /t 2 /nobreak >nul

:: Set Ollama env for this session
set "OLLAMA_HOST=0.0.0.0"
set "OLLAMA_ORIGINS=*"

:: Launch watchdog (handles starting both proxy and ollama)
start "" /min powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%DIR%\watchdog.ps1"

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
echo   Proxy:  port 8080
echo   Ollama: port 11434
echo.
echo   Services are running in the background.
echo   You can close this window.
echo.
