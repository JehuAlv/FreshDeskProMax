Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if already running
Set exec = WshShell.Exec("cmd /c netstat -ano | findstr ""LISTENING"" | findstr "":8080""")
If Len(exec.StdOut.ReadAll) > 0 Then WScript.Quit

' Start proxy hidden
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && python proxy.py", 0, False
