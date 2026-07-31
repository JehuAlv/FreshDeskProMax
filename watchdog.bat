@echo off
title Freshdesk Dashboard - Watchdog
:loop
echo [watchdog] Starting proxy... >> "%~dp0watchdog.log"
python proxy.py >> "%~dp0watchdog.log" 2>&1
echo [watchdog] Proxy exited, restarting in 3 seconds... >> "%~dp0watchdog.log"
timeout /t 3 /nobreak >nul
goto loop
