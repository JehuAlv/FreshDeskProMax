@echo off
title Freshdesk Dashboard - Stopping...

echo Stopping Freshdesk Dashboard services...

:: Kill proxy (Python on port 8080)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080.*LISTENING" 2^>nul') do taskkill /f /pid %%p >nul 2>&1

:: Kill Ollama
taskkill /f /im ollama.exe >nul 2>&1

echo.
echo   All services stopped.
echo.
pause
