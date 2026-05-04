Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if proxy is already running on port 8080
Dim running
running = False
Set exec = WshShell.Exec("cmd /c netstat -ano | findstr ""LISTENING"" | findstr "":8080""")
If Len(exec.StdOut.ReadAll) > 0 Then running = True

If Not running Then
    ' Start proxy hidden
    WshShell.Run "cmd /c cd /d """ & scriptDir & """ && python proxy.py", 0, False
    WScript.Sleep 1500
End If

' Open browser
WshShell.Run "http://localhost:8080", 0, False
