@echo off
setlocal enabledelayedexpansion
title Building Freshdesk Dashboard Installer...

set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "7Z=C:\Program Files\7-Zip\7z.exe"
set "TEMP_DIR=%TEMP%\fd-build"
set "RELEASES=%DIR%\..\releases"

:: Get version from git tag
for /f "tokens=*" %%v in ('git describe --tags --abbrev^=0 2^>nul') do set "VERSION=%%v"
if not defined VERSION set "VERSION=dev"

set "OUTPUT=%RELEASES%\FreshdeskDashboard-%VERSION%.exe"

:: Check 7-Zip
if not exist "%7Z%" (
    echo ERROR: 7-Zip not found at %7Z%
    pause
    exit /b 1
)

:: Ensure releases folder exists
if not exist "%RELEASES%" mkdir "%RELEASES%"

:: Clean temp
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%\content"

:: Copy files (exclude build artifacts)
echo Copying files...
for %%e in (bat py html css txt json) do (
    for %%f in ("%DIR%\*.%%e") do (
        if /i not "%%~nxf"=="build-installer.bat" (
            if /i not "%%~nxf"=="build-exclude.txt" (
                copy "%%f" "%TEMP_DIR%\content\" >nul
            )
        )
    )
)
xcopy "%DIR%\js\*" "%TEMP_DIR%\content\js\" /y /i /q >nul
xcopy "%DIR%\data\*" "%TEMP_DIR%\content\data\" /y /i /q >nul
mkdir "%TEMP_DIR%\content\Sharepoint"
copy "%DIR%\Sharepoint\*.py" "%TEMP_DIR%\content\Sharepoint\" >nul
copy "%DIR%\Sharepoint\*.txt" "%TEMP_DIR%\content\Sharepoint\" >nul
copy "%DIR%\Sharepoint\.env.example" "%TEMP_DIR%\content\Sharepoint\" >nul

:: Create zip
echo Creating zip...
cd /d "%TEMP_DIR%\content"
"%7Z%" a -tzip "%TEMP_DIR%\FreshdeskDashboard.zip" . -r >nul
cd /d "%DIR%"

:: Create bootstrap.bat
> "%TEMP_DIR%\bootstrap.bat" (
echo @echo off
echo setlocal enabledelayedexpansion
echo title Freshdesk Dashboard - Installer %VERSION%
echo echo.
echo echo   ============================================
echo echo     Freshdesk Dashboard - Installer %VERSION%
echo echo   ============================================
echo echo.
echo set "INSTALL_DIR=C:\FreshdeskDashboard"
echo set /p "INSTALL_DIR=  Install folder [C:\FreshdeskDashboard]: "
echo if "^^!INSTALL_DIR^^!"=="" set "INSTALL_DIR=C:\FreshdeskDashboard"
echo if not exist "^^!INSTALL_DIR^^!" mkdir "^^!INSTALL_DIR^^!"
echo echo.
echo echo   Extracting to ^^!INSTALL_DIR^^! ...
echo set "ZIPFILE=%%~dp0FreshdeskDashboard.zip"
echo echo Set s=CreateObject("Shell.Application"^) ^> "%%TEMP%%\fdx.vbs"
echo echo s.NameSpace("^^!INSTALL_DIR^^!"^).CopyHere s.NameSpace("^^!ZIPFILE^^!"^).Items, 20 ^>^> "%%TEMP%%\fdx.vbs"
echo cscript //nologo "%%TEMP%%\fdx.vbs"
echo del "%%TEMP%%\fdx.vbs" ^>nul 2^>^&1
echo echo   Extracted.
echo echo.
echo cd /d "^^!INSTALL_DIR^^!"
echo call "^^!INSTALL_DIR^^!\setup.bat"
)

:: Create SED file for iexpress
> "%TEMP_DIR%\installer.sed" (
echo [Version]
echo Class=IEXPRESS
echo SEDVersion=3
echo [Options]
echo PackagePurpose=InstallApp
echo ShowInstallProgramWindow=0
echo HideExtractAnimation=0
echo UseLongFileName=1
echo InsideCompressed=0
echo CAB_FixedSize=0
echo CAB_ResvCodeSigning=0
echo RebootMode=N
echo InstallPrompt=%%InstallPrompt%%
echo DisplayLicense=%%DisplayLicense%%
echo FinishMessage=%%FinishMessage%%
echo TargetName=%%TargetName%%
echo FriendlyName=%%FriendlyName%%
echo AppLaunched=%%AppLaunched%%
echo PostInstallCmd=%%PostInstallCmd%%
echo AdminQuietInstCmd=%%AdminQuietInstCmd%%
echo UserQuietInstCmd=%%UserQuietInstCmd%%
echo SourceFiles=SourceFiles
echo [Strings]
echo InstallPrompt=Install Freshdesk Dashboard %VERSION%?
echo DisplayLicense=
echo FinishMessage=
echo TargetName=%OUTPUT%
echo FriendlyName=Freshdesk Dashboard %VERSION%
echo AppLaunched=bootstrap.bat
echo PostInstallCmd=^<None^>
echo AdminQuietInstCmd=
echo UserQuietInstCmd=
echo FILE0="bootstrap.bat"
echo FILE1="FreshdeskDashboard.zip"
echo [SourceFiles]
echo SourceFiles0=%TEMP_DIR%\
echo [SourceFiles0]
echo %%FILE0%%=
echo %%FILE1%%=
)

:: Build with iexpress
echo Building installer...
"%SystemRoot%\System32\iexpress.exe" /N /Q "%TEMP_DIR%\installer.sed"

:: Cleanup
rd /s /q "%TEMP_DIR%"

if exist "%OUTPUT%" (
    echo.
    echo ============================================
    echo   Installer created: %VERSION%
    echo   %OUTPUT%
    echo ============================================
    for %%A in ("%OUTPUT%") do echo   Size: %%~zA bytes
    echo.
) else (
    echo ERROR: Failed to create installer
)
pause
