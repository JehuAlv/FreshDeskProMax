@echo off
setlocal enabledelayedexpansion
title Freshdesk Dashboard - Server Setup

:: Auto-elevate to admin
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
        %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs -WorkingDirectory '%~dp0'"
    ) else (
        echo   Please right-click setup.bat and select "Run as administrator"
        pause
        exit /b 1
    )
    exit /b
)

color 0A
echo ============================================
echo   Freshdesk Dashboard - Server Setup
echo ============================================
echo.

:: Get current directory
set "INSTALL_DIR=%~dp0"
set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"
cd /d "%INSTALL_DIR%"

:: 1. Check/Install Python
echo [1/7] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Python not found. Downloading installer...
    call :download "https://www.python.org/ftp/python/3.13.3/python-3.13.3-amd64.exe" "%TEMP%\python-installer.exe"
    if not exist "%TEMP%\python-installer.exe" (
        echo.
        echo   ERROR: Automatic download failed.
        echo   Please download Python manually:
        echo   https://www.python.org/downloads/
        echo   IMPORTANT: Check "Add Python to PATH" during installation
        echo   Then run setup.bat again.
        pause
        exit /b 1
    )
    echo   Installing Python silently...
    start /wait "" "%TEMP%\python-installer.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1
    del "%TEMP%\python-installer.exe" >nul 2>&1
    :: Refresh PATH from registry
    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=!PATH!;%%B"
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
echo [2/7] Checking Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   Ollama not found. Downloading installer...
    call :download "https://ollama.com/download/OllamaSetup.exe" "%TEMP%\OllamaSetup.exe"
    if not exist "%TEMP%\OllamaSetup.exe" (
        echo.
        echo   ERROR: Automatic download failed.
        echo   Please download Ollama manually: https://ollama.com/download
        echo   Then run setup.bat again.
        pause
        exit /b 1
    )
    echo   Installing Ollama silently...
    start /wait "" "%TEMP%\OllamaSetup.exe" /VERYSILENT /NORESTART
    del "%TEMP%\OllamaSetup.exe" >nul 2>&1
    echo   Ollama installed.
) else (
    echo   Ollama already installed.
)
echo.

:: 3. Set environment variables (persist across reboots)
echo [3/7] Configuring environment variables...
setx OLLAMA_HOST "0.0.0.0" /M >nul 2>&1
setx OLLAMA_ORIGINS "*" /M >nul 2>&1
set "OLLAMA_HOST=0.0.0.0"
set "OLLAMA_ORIGINS=*"
echo   OLLAMA_HOST=0.0.0.0
echo   OLLAMA_ORIGINS=*
echo.

:: 4. Install Python dependencies
echo [4/7] Installing Python dependencies...
pip install -r "%INSTALL_DIR%\Sharepoint\requirements.txt" --quiet
echo   Dependencies installed.
echo.

:: 5. Pull AI model
echo [5/7] Downloading AI model (qwen3.5:9b ~6GB)...
echo   This may take several minutes on first run...
"%LOCALAPPDATA%\Programs\Ollama\ollama.exe" pull qwen3.5:9b
echo.

:: 6. Firewall rules
echo [6/7] Configuring firewall...
netsh advfirewall firewall delete rule name="FreshdeskDashboard-Proxy" >nul 2>&1
netsh advfirewall firewall delete rule name="FreshdeskDashboard-Ollama" >nul 2>&1
netsh advfirewall firewall add rule name="FreshdeskDashboard-Proxy" dir=in action=allow protocol=TCP localport=8080 >nul
netsh advfirewall firewall add rule name="FreshdeskDashboard-Ollama" dir=in action=allow protocol=TCP localport=11434 >nul
echo   Port 8080 (proxy) - opened
echo   Port 11434 (Ollama) - opened
echo.

:: 7. Create scheduled task for auto-start
echo [7/7] Creating auto-start task...
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
exit /b

:: ============================================
:: Download function - tries multiple methods
:: Usage: call :download "URL" "FILE"
:: ============================================
:download
set "DL_URL=%~1"
set "DL_FILE=%~2"
if exist "%DL_FILE%" del "%DL_FILE%" >nul 2>&1

:: Method 1: certutil (uses CryptoAPI/Schannel, follows IE TLS settings)
echo   Trying certutil...
certutil -urlcache -split -f "%DL_URL%" "%DL_FILE%" >nul 2>&1
if exist "%DL_FILE%" (
    echo   Download OK.
    exit /b 0
)

:: Method 2: PowerShell with TLS 1.2
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
    echo   Trying PowerShell...
    %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('%DL_URL%', '%DL_FILE%')" >nul 2>&1
    if exist "%DL_FILE%" (
        echo   Download OK.
        exit /b 0
    )
)

:: Method 3: bitsadmin
echo   Trying bitsadmin...
bitsadmin /transfer "FDDownload" /priority high "%DL_URL%" "%DL_FILE%" >nul 2>&1
if exist "%DL_FILE%" (
    echo   Download OK.
    exit /b 0
)

:: Method 4: VBScript (uses WinInet, same TLS as Internet Explorer)
echo   Trying VBScript...
echo Set x=CreateObject("MSXML2.XMLHTTP") > "%TEMP%\dl.vbs"
echo x.Open "GET",WScript.Arguments(0),False >> "%TEMP%\dl.vbs"
echo x.Send >> "%TEMP%\dl.vbs"
echo Set s=CreateObject("ADODB.Stream") >> "%TEMP%\dl.vbs"
echo s.Type=1 >> "%TEMP%\dl.vbs"
echo s.Open >> "%TEMP%\dl.vbs"
echo s.Write x.responseBody >> "%TEMP%\dl.vbs"
echo s.SaveToFile WScript.Arguments(1),2 >> "%TEMP%\dl.vbs"
echo s.Close >> "%TEMP%\dl.vbs"
cscript //nologo "%TEMP%\dl.vbs" "%DL_URL%" "%DL_FILE%" >nul 2>&1
del "%TEMP%\dl.vbs" >nul 2>&1
if exist "%DL_FILE%" (
    echo   Download OK.
    exit /b 0
)

echo   All download methods failed.
exit /b 1
