@echo off
title Freshdesk Dashboard - Watchdog
:loop
echo [watchdog] Starting proxy...
python proxy.py
echo [watchdog] Proxy exited, restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto loop
