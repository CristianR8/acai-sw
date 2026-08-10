param(
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 1500
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connectResult = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $connectResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }
    $client.EndConnect($connectResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-PostgresService {
  $service = Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "^postgresql" -or $_.DisplayName -match "PostgreSQL" } |
    Sort-Object Name |
    Select-Object -First 1
  return $service
}

$postgresService = Get-PostgresService
if ($postgresService) {
  if ($postgresService.Status -ne "Running") {
    Write-Host "Iniciando servicio PostgreSQL: $($postgresService.Name)"
    Start-Service -Name $postgresService.Name
  } else {
    Write-Host "Servicio PostgreSQL activo: $($postgresService.Name)"
  }
} else {
  Write-Host "Aviso: no se encontro servicio PostgreSQL. Se validara conectividad al puerto."
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$ready = $false
while ((Get-Date) -lt $deadline) {
  if (Test-TcpPort -HostName $PgHost -Port $PgPort) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  throw "PostgreSQL no responde en ${PgHost}:${PgPort} tras ${TimeoutSeconds}s."
}

Write-Host "PostgreSQL listo en ${PgHost}:${PgPort}"
