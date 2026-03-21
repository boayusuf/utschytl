Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\Users\yusuf\sentinel-garden && npm run dev", 0, False
WScript.Sleep 2000
WshShell.Run "http://localhost:5173", 0, False
