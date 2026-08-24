Option Explicit

Dim shell, fso, projectRoot, launcher, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectRoot = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = projectRoot & "\deploy\windows-admin\start-admin.ps1"

exitCode = shell.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & launcher & """ -ProjectRoot """ & projectRoot & """", 0, True)
If exitCode <> 0 Then
  shell.Popup "No se pudo iniciar ACAI PARK Administrador." & vbCrLf & vbCrLf & "Consulta el registro en:" & vbCrLf & projectRoot & "\logs\admin-launcher.log", 0, "ACAI PARK Administrador", 16
End If
