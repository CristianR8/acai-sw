param(
  [string]$ProjectRoot = "C:\acaipark-sw"
)

$ErrorActionPreference = "Stop"
$startScript = Join-Path $ProjectRoot "deploy\windows-native\start-all.ps1"
$frontendUrl = "http://localhost:3000"
$backendUrl = "http://localhost:8000/docs"
$logsDir = Join-Path $env:LOCALAPPDATA "AcaiPark\logs"

& powershell -ExecutionPolicy Bypass -File $startScript -ProjectRoot $ProjectRoot

function Wait-HttpReady {
  param(
    [string]$Url,
    [int]$MaxWaitSeconds = 60
  )

  $attempts = [Math]::Max(1, [int][Math]::Ceiling($MaxWaitSeconds / 2))
  for ($i = 0; $i -lt $attempts; $i++) {
    Start-Sleep -Seconds 2
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      # Seguimos esperando.
    }
  }
  return $false
}

$backendReady = Wait-HttpReady -Url $backendUrl -MaxWaitSeconds 60
$frontendReady = Wait-HttpReady -Url $frontendUrl -MaxWaitSeconds 90

if ($backendReady -and $frontendReady) {
  Start-Process $frontendUrl
} else {
  Write-Host "No se pudo iniciar la app por completo."
  Write-Host "Backend OK: $backendReady | Frontend OK: $frontendReady"
  Write-Host "Revisa logs en:"
  Write-Host " - $(Join-Path $logsDir 'frontend.log')"
  Write-Host " - $(Join-Path $logsDir 'backend.log')"
}
