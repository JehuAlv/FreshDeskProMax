@echo off
setlocal enabledelayedexpansion
title Freshdesk Dashboard - Server Setup
color 0A

:: Check admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ============================================
    echo   ERROR: Run this as Administrator
    echo   Right-click setup.bat ^> Run as administrator
    echo ============================================
    pause
    exit /b 1
)

echo ============================================
echo   Freshdesk Dashboard - Server Setup
echo ============================================
echo.

:: Get current directory
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

:: 1. Check/Install Python
echo [1/6] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Python not found. Downloading installer...
    curl -L -o "%TEMP%\python-installer.exe" "https://www.python.org/ftp/python/3.13.3/python-3.13.3-amd64.exe"
    if not exist "%TEMP%\python-installer.exe" (
        echo   ERROR: Failed to download Python
        echo   Please install manually from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    echo   Installing Python silently...
    start /wait "" "%TEMP%\python-installer.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1
    del "%TEMP%\python-installer.exe" >nul 2>&1
    :: Refresh PATH for this session
    set "PATH=%PATH%;C:\Program Files\Python313;C:\Program Files\Python313\Scripts"
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo   ERROR: Python installation failed
        echo   Please install manually from https://www.python.org/downloads/
        echo   IMPORTANT: Check "Add Python to PATH" during installation
        pause
        exit /b 1
    )
    echo   Python installed successfully.
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo   Found: %%i
echo.

:: 2. Check/Install Ollama
echo [2/6] Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   Ollama not found. Downloading installer...
    curl -L -o "%TEMP%\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"
    if not exist "%TEMP%\OllamaSetup.exe" (
        echo   ERROR: Failed to download Ollama
        echo   Please install manually from https://ollama.com/download
        pause
        exit /b 1
    )
    echo   Installing Ollama silently...
    start /wait "%TEMP%\OllamaSetup.exe" /VERYSILENT /NORESTART
    echo   Ollama installed.
) else (
    echo   Ollama already installed.
)
echo.

:: 3. Set environment variables (persist across reboots)
echo [3/6] Configuring environment variables...
setx OLLAMA_HOST "0.0.0.0" /M >nul 2>&1
setx OLLAMA_ORIGINS "*" /M >nul 2>&1
set "OLLAMA_HOST=0.0.0.0"
set "OLLAMA_ORIGINS=*"
echo   OLLAMA_HOST=0.0.0.0
echo   OLLAMA_ORIGINS=*
echo.

:: 4. Pull Gemma model
echo [4/6] Downloading AI model (gemma3:4b ~3.3GB)...
echo   This may take several minutes on first run...
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull gemma3:4b
echo.

:: 5. Firewall rules
echo [5/6] Configuring firewall...
netsh advfirewall firewall delete rule name="FreshdeskDashboard-Proxy" >nul 2>&1
netsh advfirewall firewall delete rule name="FreshdeskDashboard-Ollama" >nul 2>&1
netsh advfirewall firewall add rule name="FreshdeskDashboard-Proxy" dir=in action=allow protocol=TCP localport=8080 >nul
netsh advfirewall firewall add rule name="FreshdeskDashboard-Ollama" dir=in action=allow protocol=TCP localport=11434 >nul
echo   Port 8080 (proxy) - opened
echo   Port 11434 (Ollama) - opened
echo.

:: 6. Create scheduled task for auto-start
echo [6/6] Creating auto-start task...
schtasks /delete /tn "FreshdeskDashboard" /f >nul 2>&1
schtasks /create /tn "FreshdeskDashboard" /tr "\"%INSTALL_DIR%\start.bat\"" /sc onlogon /rl highest /f >nul
echo   Auto-start on login configured.
echo.

:: Start services now
echo Starting services...
call "%INSTALL_DIR%\start.bat"

echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   To use the dashboard, open a browser and go to:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    set "ip=!ip: =!"
    if not "!ip!"=="" echo   http://!ip!:8080
)
echo.
echo   Other PCs on the network can also access this URL.
echo   Services will auto-start when this PC boots.
echo.
pause
