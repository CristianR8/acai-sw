param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$backendDir = Join-Path $ProjectRoot "acaipark-back"
$venvPy = Join-Path $backendDir ".venv\Scripts\python.exe"
$backendEnv = Join-Path $backendDir ".env"
$logDir = Join-Path $env:LOCALAPPDATA "AcaiPark\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (!(Test-Path $venvPy)) {
  throw "No existe $venvPy. Ejecuta primero setup-native.ps1"
}
if (!(Test-Path $backendEnv)) {
  throw "No existe $backendEnv. Ejecuta primero setup-native.ps1"
}

try {
  $existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
} catch {
  $existingListener = $null
}

if ($existingListener) {
  Write-Host "Puerto $Port ya en uso (PID $($existingListener.OwningProcess)). No se inicia otra instancia backend."
  exit 0
}

Push-Location $backendDir
try {
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $venvPy -m uvicorn app.main:app --host 0.0.0.0 --port $Port --env-file $backendEnv *>> (Join-Path $logDir "backend.log")
  $code = $LASTEXITCODE
  $ErrorActionPreference = $oldPreference
  if ($code -ne 0) {
    throw "Backend finalizo con codigo $code. Revisa backend.log"
  }
}
finally {
  Pop-Location
}
