@echo off
setlocal enabledelayedexpansion
title FreshDesk Pro Max - Release

:: One step for a stable release: build the versioned installer and publish it
:: as a GitHub release asset, so users only download and double-click.
::
:: Safe to double-click -- it asks for the version. Or pass it directly:
::   installer\release.bat v1.4.0
::
:: Commit first. This script tags, builds, pushes and publishes; it never commits.

:: BUILD = this folder. DIR = repo root.
set "BUILD=%~dp0"
set "BUILD=%BUILD:~0,-1%"
for %%i in ("%BUILD%\..") do set "DIR=%%~fi"

echo.
echo   ============================================
echo     FreshDesk Pro Max - Release
echo   ============================================
echo.

:: ── Refuse a dirty tree ──
:: build-installer.bat stages the payload from the working tree, not from git, so
:: uncommitted or untracked files would ship inside the .exe while the tag points
:: at a commit that does not contain them.
set "DIRTY="
for /f "delims=" %%s in ('git -C "%DIR%" status --porcelain 2^>nul') do set "DIRTY=1"
if defined DIRTY (
    echo   ERROR: working tree is not clean. Commit or stash first:
    echo.
    git -C "%DIR%" status --short
    echo.
    pause
    exit /b 1
)

:: ── Which version? ──
set "LATEST="
for /f "tokens=*" %%v in ('git -C "%DIR%" describe --tags --abbrev^=0 2^>nul') do set "LATEST=%%v"

set "VERSION=%~1"
if not defined VERSION (
    if defined LATEST (
        echo   Current version: !LATEST!
        echo.
        set /p "VERSION=  New version (Enter = rebuild !LATEST!): "
    ) else (
        echo   No git tag exists yet.
        echo.
        set /p "VERSION=  Version to release (e.g. v1.0.0): "
    )
)
if not defined VERSION set "VERSION=%LATEST%"
if not defined VERSION (
    echo.
    echo   ERROR: no version given and no git tag found.
    pause
    exit /b 1
)

:: ── Tag ──
:: /f is not used here on purpose: silently moving an existing tag would leave a
:: published release pointing at different code than the tag now claims.
git -C "%DIR%" rev-parse "%VERSION%" >nul 2>&1
if errorlevel 1 (
    echo   Tagging HEAD as %VERSION% ...
    git -C "%DIR%" tag -a "%VERSION%" -m "Release %VERSION%"
    if errorlevel 1 (
        echo   ERROR: could not create tag %VERSION%
        pause
        exit /b 1
    )
) else (
    echo   Tag %VERSION% already exists, reusing it.
)
echo.

:: ── Build ── FD_CHAINED suppresses the builder's pauses.
set "FD_CHAINED=1"
call "%BUILD%\build-installer.bat"
if errorlevel 1 (
    echo   ERROR: build failed, nothing was published.
    pause
    exit /b 1
)

set "ASSET=%DIR%\deploy\FreshdeskDashboard-%VERSION%.exe"
if not exist "%ASSET%" (
    echo   ERROR: expected installer not found: %ASSET%
    pause
    exit /b 1
)

:: ── Push ──
echo   Pushing commit and tag...
git -C "%DIR%" push origin HEAD
if errorlevel 1 (
    echo   ERROR: push failed, nothing was published.
    pause
    exit /b 1
)
git -C "%DIR%" push origin "%VERSION%"
if errorlevel 1 (
    echo   ERROR: could not push tag %VERSION%
    pause
    exit /b 1
)

:: ── Publish ──
echo   Publishing release asset...
python "%BUILD%\publish-release.py" "%VERSION%" "%ASSET%"
if errorlevel 1 (
    echo   ERROR: publishing failed. The commit and tag are pushed; re-run this
    echo   script to retry just the upload.
    pause
    exit /b 1
)

echo.
echo   ============================================
echo     Done: %VERSION% released.
echo   ============================================
echo.
pause
