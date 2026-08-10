param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [string]$RunAsUser = $env:USERNAME
)

$ErrorActionPreference = "Stop"

$ps = "powershell.exe"
$backendScript = Join-Path $ProjectRoot "deploy\windows-native\start-backend.ps1"
$frontendScript = Join-Path $ProjectRoot "deploy\windows-native\start-frontend.ps1"

$backendAction = New-ScheduledTaskAction -Execute $ps -Argument "-ExecutionPolicy Bypass -File `"$backendScript`" -ProjectRoot `"$ProjectRoot`" -Port 8000"
$frontendAction = New-ScheduledTaskAction -Execute $ps -Argument "-ExecutionPolicy Bypass -File `"$frontendScript`" -ProjectRoot `"$ProjectRoot`" -Port 3000"

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $RunAsUser
$principal = New-ScheduledTaskPrincipal -UserId $RunAsUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "AcaiParkBackend" -Action $backendAction -Trigger $trigger -Principal $principal -Settings $settings -Force
Register-ScheduledTask -TaskName "AcaiParkFrontend" -Action $frontendAction -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "Tareas registradas: AcaiParkBackend y AcaiParkFrontend"
Write-Host "Usa start-all.ps1 para arrancar inmediatamente."
