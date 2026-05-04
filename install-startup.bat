@echo off
echo Creating startup shortcut for FreshdeskDashboard proxy...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\FreshdeskProxy.lnk'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%~dp0start-proxy.vbs\"'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Save()"
echo Done. Proxy will auto-start on login.
pause
