param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"

$ensurePostgresScript = Join-Path $ProjectRoot "deploy\windows-native\ensure-postgres.ps1"
$backendPython = Join-Path $ProjectRoot "acaipark-back\.venv\Scripts\python.exe"
$frontNodeModules = Join-Path $ProjectRoot "acaipark-front\node_modules"
$frontBuild = Join-Path $ProjectRoot "acaipark-front\.next\BUILD_ID"
$startBackendScript = Join-Path $ProjectRoot "deploy\windows-native\start-backend.ps1"
$startFrontendScript = Join-Path $ProjectRoot "deploy\windows-native\start-frontend.ps1"

if (!(Test-Path $ensurePostgresScript)) {
  throw "No existe $ensurePostgresScript"
}

if (!(Test-Path $backendPython) -or !(Test-Path $frontNodeModules) -or !(Test-Path $frontBuild)) {
  throw @"
La app aun no esta preparada para arrancar.
Faltan artefactos de instalacion (backend/frontend build).

Ejecuta primero:
  .\deploy\windows-native\quick-install.ps1 -ProjectRoot "$ProjectRoot"

o de forma manual:
  .\deploy\windows-native\setup-native.ps1 -ProjectRoot "$ProjectRoot" -PgUser girona_user -PgPassword "TU_PASSWORD" -PgDatabase girona_prod
"@
}

& powershell -ExecutionPolicy Bypass -File $ensurePostgresScript -PgHost $PgHost -PgPort $PgPort -TimeoutSeconds 90

function Test-PortListening {
  param([int]$Port)
  try {
    $entry = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $entry
  } catch {
    return $false
  }
}

function Wait-ForPort {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 20
  )

  $tries = [Math]::Max(1, [int][Math]::Ceiling($TimeoutSeconds / 2))
  for ($i = 0; $i -lt $tries; $i++) {
    if (Test-PortListening -Port $Port) {
      return $true
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

function Start-BackendDirect {
  Start-Process powershell -WindowStyle Minimized -ArgumentList "-ExecutionPolicy Bypass -File `"$startBackendScript`" -ProjectRoot `"$ProjectRoot`" -Port 8000"
}

function Start-FrontendDirect {
  Start-Process powershell -WindowStyle Minimized -ArgumentList "-ExecutionPolicy Bypass -File `"$startFrontendScript`" -ProjectRoot `"$ProjectRoot`" -Port 3000"
}

if (-not (Test-PortListening -Port 8000)) {
  Start-BackendDirect
}
if (-not (Wait-ForPort -Port 8000 -TimeoutSeconds 20)) {
  Write-Host "Aviso: backend no dejo puerto 8000 activo. Reintentando arranque..."
  Start-BackendDirect
  if (-not (Wait-ForPort -Port 8000 -TimeoutSeconds 20)) {
    throw "No se pudo iniciar backend en puerto 8000."
  }
}

if (-not (Test-PortListening -Port 3000)) {
  Start-FrontendDirect
}
if (-not (Wait-ForPort -Port 3000 -TimeoutSeconds 25)) {
  Write-Host "Aviso: frontend no dejo puerto 3000 activo. Reintentando arranque..."
  Start-FrontendDirect
  if (-not (Wait-ForPort -Port 3000 -TimeoutSeconds 25)) {
    throw "No se pudo iniciar frontend en puerto 3000."
  }
}

Write-Host "Backend: http://localhost:8000"
Write-Host "Frontend: http://localhost:3000"
