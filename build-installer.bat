@echo off
setlocal enabledelayedexpansion
title Building FreshDesk Pro Max Installer...

:: Builds a single double-click installer .exe via IExpress:
::   installer.exe -> launcher.vbs -> bootstrap.cmd -> install.cmd (elevated) -> setup.hta
:: Output goes to deploy\, which is gitignored; ship it as a GitHub release asset.

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "SEVENZIP=C:\Program Files\7-Zip\7z.exe"
set "STAGE=%TEMP%\fd-build"
set "DEPLOY=%DIR%\deploy"

:: ── Version from git tag ──
set "VERSION="
for /f "tokens=*" %%v in ('git -C "%DIR%" describe --tags --abbrev^=0 2^>nul') do set "VERSION=%%v"
if not defined VERSION set "VERSION=dev"
set "OUTPUT=%DEPLOY%\FreshdeskDashboard-%VERSION%.exe"

echo.
echo   ============================================
echo     FreshDesk Pro Max - Installer Builder
echo     Version: %VERSION%
echo   ============================================
echo.

:: ── Prerequisites ──
if not exist "%SEVENZIP%" (
    echo ERROR: 7-Zip not found at %SEVENZIP%
    pause
    exit /b 1
)
if not exist "%SystemRoot%\System32\iexpress.exe" (
    echo ERROR: iexpress.exe not found
    pause
    exit /b 1
)
for %%f in (bootstrap.cmd launcher.vbs install.cmd setup.hta build-sed.py) do (
    if not exist "%DIR%\%%f" (
        echo ERROR: required file missing: %%f
        pause
        exit /b 1
    )
)

if not exist "%DEPLOY%" mkdir "%DEPLOY%"
if exist "%STAGE%" rd /s /q "%STAGE%"
mkdir "%STAGE%\content"

:: ── Stage payload: explicit whitelist only ──
:: Never use a wildcard sweep here. Sharepoint\.env and Sharepoint\token_cache.json
:: hold live credentials, and this .exe is published publicly.
echo   Staging files...
for %%f in (
    index.html styles.css ai_pipeline.js ai_search_index.json
    proxy.py install.cmd setup.hta setup.bat
    start.bat stop.bat watchdog.bat watchdog.vbs
    README.txt
) do (
    if exist "%DIR%\%%f" (
        copy /y "%DIR%\%%f" "%STAGE%\content\" >nul
    ) else (
        echo   WARNING: %%f not found, skipping
    )
)

xcopy "%DIR%\js\*.js" "%STAGE%\content\js\" /y /i /q >nul
xcopy "%DIR%\data\*.js" "%STAGE%\content\data\" /y /i /q >nul

mkdir "%STAGE%\content\Sharepoint"
copy /y "%DIR%\Sharepoint\create_ticket_folder.py" "%STAGE%\content\Sharepoint\" >nul
copy /y "%DIR%\Sharepoint\requirements.txt" "%STAGE%\content\Sharepoint\" >nul
copy /y "%DIR%\Sharepoint\.env.example" "%STAGE%\content\Sharepoint\" >nul

:: ── Secret audit: refuse to build if anything sensitive got staged ──
echo   Auditing payload for secrets...
set "LEAK="
for %%p in (.env token_cache.json) do (
    if exist "%STAGE%\content\Sharepoint\%%p" set "LEAK=1"
)
if exist "%STAGE%\content\Sharepoint\.env" set "LEAK=1"
dir /s /b "%STAGE%\content" | findstr /i /e "\\.env" >nul 2>&1 && set "LEAK=1"
dir /s /b "%STAGE%\content" | findstr /i "token_cache" >nul 2>&1 && set "LEAK=1"
if defined LEAK (
    echo.
    echo   ERROR: credential file found in payload - build aborted.
    dir /s /b "%STAGE%\content" | findstr /i "\.env token_cache"
    rd /s /q "%STAGE%"
    pause
    exit /b 1
)
echo   Payload clean.

:: ── Zip ──
echo   Creating zip...
pushd "%STAGE%\content"
"%SEVENZIP%" a -tzip "%STAGE%\FreshdeskDashboard.zip" . -r >nul
popd
if not exist "%STAGE%\FreshdeskDashboard.zip" (
    echo ERROR: zip creation failed
    rd /s /q "%STAGE%"
    pause
    exit /b 1
)

:: ── Bootstrap + launcher alongside the zip ──
copy /y "%DIR%\bootstrap.cmd" "%STAGE%\" >nul
copy /y "%DIR%\launcher.vbs" "%STAGE%\" >nul

:: ── SED for IExpress ──
echo   Generating SED...
python "%DIR%\build-sed.py" "%STAGE%" "%OUTPUT%" "%VERSION%"
if not exist "%STAGE%\installer.sed" (
    echo ERROR: SED generation failed
    rd /s /q "%STAGE%"
    pause
    exit /b 1
)

:: ── Build ──
:: iexpress.exe does NOT strip quotes from the .sed argument: a quoted path makes it
:: try to open a filename that literally contains the quote characters and it dies with
:: "Error opening the IExpress Self Extraction Directive file". It also always exits 0,
:: so the errorlevel is useless -- the only reliable check is whether %OUTPUT% appeared.
:: Hence: cd into the stage and pass the bare (space-free) filename.
echo   Building installer...
if exist "%OUTPUT%" del /f /q "%OUTPUT%"
pushd "%STAGE%"
"%SystemRoot%\System32\iexpress.exe" /N /Q installer.sed
popd

:: Keep the stage when the build fails so the .sed and payload can be inspected.
if exist "%OUTPUT%" rd /s /q "%STAGE%"

if exist "%OUTPUT%" (
    echo.
    echo   ============================================
    echo     Installer built: %VERSION%
    echo     %OUTPUT%
    for %%A in ("%OUTPUT%") do echo     Size: %%~zA bytes
    echo   ============================================
    echo.
) else (
    echo.
    echo   ERROR: installer was not created.
    echo   Stage kept for inspection: %STAGE%
    echo   Re-run without /Q to see the IExpress error:
    echo     pushd "%STAGE%" ^&^& iexpress /N installer.sed
    echo.
    exit /b 1
)
