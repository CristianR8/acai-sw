param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
$backendDir = Join-Path $ProjectRoot "acaipark-back"
$venvPy = Join-Path $backendDir ".venv\Scripts\python.exe"
$backendEnv = Join-Path $backendDir ".env"
$logDir = Join-Path $env:LOCALAPPDATA "AcaiPark\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (!(Test-Path $venvPy) -or !(Test-Path $backendEnv)) {
  throw "Falta el entorno local del backend o su archivo .env."
}

Push-Location $backendDir
try {
  & $venvPy -m uvicorn app.print_agent:app --host 127.0.0.1 --port $Port --env-file $backendEnv *>> (Join-Path $logDir "print-agent.log")
} finally {
  Pop-Location
}
