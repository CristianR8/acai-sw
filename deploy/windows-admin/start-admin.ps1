param(
  [string]$ProjectRoot = "C:\Users\This\acai-sw-admin"
)

$ErrorActionPreference = "Stop"
$composeFile = Join-Path $ProjectRoot "docker-compose.yml"
$launcherLog = Join-Path $ProjectRoot "logs\admin-launcher.log"
New-Item -ItemType Directory -Force -Path (Split-Path $launcherLog -Parent) | Out-Null

trap {
  "[$(Get-Date -Format s)] $($_ | Out-String)" | Add-Content -Path $launcherLog -Encoding UTF8
  exit 1
}

function Test-DockerReady {
  & cmd.exe /d /c 'docker version --format "{{.Server.Version}}" >NUL 2>&1'
  return $LASTEXITCODE -eq 0
}

function Wait-Until {
  param([scriptblock]$Condition, [int]$TimeoutSeconds, [string]$Description)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (& $Condition) { return }
    Start-Sleep -Seconds 2
  }
  throw "Tiempo de espera agotado: $Description"
}

if (!(Test-Path $composeFile)) { throw "No se encontró $composeFile" }

if (!(Test-DockerReady)) {
  $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
  if (!(Test-Path $dockerDesktop)) { throw "Docker Desktop no está instalado." }
  Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
  Wait-Until -Condition ${function:Test-DockerReady} -TimeoutSeconds 120 -Description "Docker Desktop"
}

& docker compose -f $composeFile up -d db backend frontend
if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar ACAI PARK Administrador." }

Wait-Until -Condition {
  try {
    (Invoke-WebRequest -UseBasicParsing "http://localhost:3000" -TimeoutSec 5).StatusCode -eq 200
  } catch { $false }
} -TimeoutSeconds 120 -Description "frontend de administración"

Start-Process "http://localhost:3000"
