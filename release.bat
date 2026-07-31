@echo off
setlocal enabledelayedexpansion
title FreshDesk Pro Max - Release

:: One step for a stable release: build the versioned installer and publish it
:: as a GitHub release asset, so users only download and double-click.
::
:: Usage:
::   release.bat            -> uses the latest git tag
::   release.bat v1.4.0     -> creates that tag on HEAD first, then builds
::
:: Tag the commit BEFORE building: build-installer.bat takes the version from
:: `git describe --tags`, so an untagged bump would ship the previous version.

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"

if not "%~1"=="" (
    git -C "%DIR%" rev-parse "%~1" >nul 2>&1
    if errorlevel 1 (
        echo   Tagging HEAD as %~1 ...
        git -C "%DIR%" tag -a "%~1" -m "Release %~1" || exit /b 1
    ) else (
        echo   Tag %~1 already exists, reusing it.
    )
    set "VERSION=%~1"
) else (
    set "VERSION="
    for /f "tokens=*" %%v in ('git -C "%DIR%" describe --tags --abbrev^=0 2^>nul') do set "VERSION=%%v"
    if not defined VERSION (
        echo   ERROR: no git tag found. Pass a version: release.bat v1.0.0
        exit /b 1
    )
)

echo   Releasing %VERSION%
echo.

call "%DIR%\build-installer.bat" || exit /b 1

set "ASSET=%DIR%\deploy\FreshdeskDashboard-%VERSION%.exe"
if not exist "%ASSET%" (
    echo   ERROR: expected installer not found: %ASSET%
    exit /b 1
)

echo   Pushing commit and tag...
git -C "%DIR%" push origin HEAD || exit /b 1
git -C "%DIR%" push origin "%VERSION%" || exit /b 1

echo   Publishing release asset...
python "%DIR%\publish-release.py" "%VERSION%" "%ASSET%" || exit /b 1

echo.
echo   Done: %VERSION% released.
