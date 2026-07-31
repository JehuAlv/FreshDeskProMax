Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
myDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c """ & myDir & "\bootstrap.cmd""", 0, True
