$ErrorActionPreference = "SilentlyContinue"

# Detiene tareas si existen
$backendTask = Get-ScheduledTask -TaskName "AcaiParkBackend" -ErrorAction SilentlyContinue
$frontendTask = Get-ScheduledTask -TaskName "AcaiParkFrontend" -ErrorAction SilentlyContinue
if ($backendTask) { Stop-ScheduledTask -TaskName "AcaiParkBackend" }
if ($frontendTask) { Stop-ScheduledTask -TaskName "AcaiParkFrontend" }

# Mata solo procesos escuchando puertos de la app
$ports = @(3000, 8000)
foreach ($port in $ports) {
  $entries = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($entry in $entries) {
    Stop-Process -Id $entry.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Procesos detenidos."
