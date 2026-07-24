@echo off
setlocal enabledelayedexpansion

:: Paths
set "SRC=%~dp0"
set "SRC=%SRC:~0,-1%"
set "DEST=C:\FreshdeskDashboard"
set "LOG=%DEST%\install.log"

:: Create install directory
if not exist "%DEST%" mkdir "%DEST%"

:: Start logging
echo [%date% %time%] install.cmd started > "%LOG%"
echo [%date% %time%] Source: %SRC% >> "%LOG%"
echo [%date% %time%] Destination: %DEST% >> "%LOG%"

:: Copy all files to install directory
echo [%date% %time%] Copying files... >> "%LOG%"
xcopy "%SRC%\*" "%DEST%\" /y /e /q >> "%LOG%" 2>&1
echo [%date% %time%] Copy done, errorlevel=%errorlevel% >> "%LOG%"

:: Launch setup.hta (already running as admin from bootstrap VBS runas)
if exist "%DEST%\setup.hta" (
    echo [%date% %time%] Launching setup.hta >> "%LOG%"
    cd /d "%DEST%"
    start "" mshta "%DEST%\setup.hta"
) else if exist "%DEST%\setup.bat" (
    echo [%date% %time%] Falling back to setup.bat >> "%LOG%"
    cd /d "%DEST%"
    call "%DEST%\setup.bat"
) else (
    echo [%date% %time%] ERROR: No setup file found >> "%LOG%"
)
