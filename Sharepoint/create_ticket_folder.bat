@echo off
:loop
echo.
set /p TICKET="Enter ticket number (or 'exit' to quit): "
if /i "%TICKET%"=="exit" goto end
python "%~dp0create_ticket_folder.py" %TICKET%
goto loop
:end
