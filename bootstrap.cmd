@echo off
setlocal enabledelayedexpansion

set "STAGE=%TEMP%\FDInstall"
set "ZIPFILE=%~dp0FreshdeskDashboard.zip"

:: Clean previous staging
if exist "%STAGE%" rd /s /q "%STAGE%"
mkdir "%STAGE%"

:: Check zip exists
if not exist "%ZIPFILE%" (
    echo ERROR: FreshdeskDashboard.zip not found
    pause
    exit /b 1
)

:: Extract zip to staging (user-writable, no admin needed)
%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%STAGE%' -Force" >nul 2>&1
if %errorlevel% neq 0 (
    tar -xf "%ZIPFILE%" -C "%STAGE%" >nul 2>&1
)

:: Verify extraction
if not exist "%STAGE%\install.cmd" (
    echo ERROR: Extraction failed
    pause
    exit /b 1
)

:: Launch install.cmd in a hidden window (no CMD flash)
:: Creates a temp VBS that runs install.cmd hidden + elevated
set "VBS=%TEMP%\fd-launch.vbs"
> "%VBS%" echo Set s=CreateObject("Shell.Application")
>> "%VBS%" echo s.ShellExecute "cmd.exe", "/c ""%STAGE%\install.cmd""", "%STAGE%", "runas", 0
cscript //nologo "%VBS%"
del "%VBS%" >nul 2>&1
