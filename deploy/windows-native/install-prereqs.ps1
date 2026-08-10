param(
  [switch]$Force,
  [string]$PostgresPackageId = "PostgreSQL.PostgreSQL.17"
)

$ErrorActionPreference = "Stop"

function Install-WingetPackage {
  param(
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )

  $check = winget list --id $PackageId --accept-source-agreements 2>$null
  if ($LASTEXITCODE -eq 0 -and $check -match $PackageId -and -not $Force.IsPresent) {
    Write-Host "Ya instalado: $DisplayName ($PackageId)"
    return
  }

  Write-Host "Instalando: $DisplayName ($PackageId)"
  winget install -e --id $PackageId --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo la instalacion de $DisplayName ($PackageId)."
  }
}

function Normalize-PathPart {
  param([string]$Value)
  return ($Value.Trim().TrimEnd("\")).ToLowerInvariant()
}

function Prepend-UserPathIfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$PathPart
  )

  if (-not (Test-Path $PathPart)) {
    return
  }

  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")

  $machineParts = @()
  if (-not [string]::IsNullOrWhiteSpace($machinePath)) {
    $machineParts = $machinePath -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $userParts = @()
  if (-not [string]::IsNullOrWhiteSpace($userPath)) {
    $userParts = $userPath -split ";" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  }

  $normalized = Normalize-PathPart -Value $PathPart
  $existsInMachine = $machineParts | Where-Object { (Normalize-PathPart -Value $_) -eq $normalized }
  $existsInUser = $userParts | Where-Object { (Normalize-PathPart -Value $_) -eq $normalized }

  if ($existsInMachine -or $existsInUser) {
    return
  }

  $newUserParts = @($PathPart) + $userParts
  $newUserPath = ($newUserParts -join ";")
  [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "No se encontro winget en PATH. Actualiza App Installer desde Microsoft Store."
}

Install-WingetPackage -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Install-WingetPackage -PackageId "Python.Python.3.12" -DisplayName "Python 3.12"

$postgresInstalled = $false
$postgresCandidates = @($PostgresPackageId, "PostgreSQL.PostgreSQL.16") | Select-Object -Unique
foreach ($pgId in $postgresCandidates) {
  try {
    Install-WingetPackage -PackageId $pgId -DisplayName "PostgreSQL"
    $postgresInstalled = $true
    break
  } catch {
    Write-Host "No se pudo instalar PostgreSQL con id '$pgId': $($_.Exception.Message)"
  }
}

if (-not $postgresInstalled) {
  throw "No fue posible instalar PostgreSQL con los ids probados: $($postgresCandidates -join ', ')"
}

Prepend-UserPathIfMissing -PathPart "C:\Program Files\nodejs"
Prepend-UserPathIfMissing -PathPart (Join-Path $env:LocalAppData "Programs\Python\Python312")
Prepend-UserPathIfMissing -PathPart (Join-Path $env:LocalAppData "Programs\Python\Python312\Scripts")
Prepend-UserPathIfMissing -PathPart "C:\Program Files\PostgreSQL\17\bin"

# Refresca PATH para este proceso tras actualizar PATH del usuario.
$env:Path = "{0};{1}" -f `
  [Environment]::GetEnvironmentVariable("Path", "Machine"), `
  [Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "`nValidacion de herramientas:"
try { node -v } catch { Write-Host "node no disponible aun (reinicia terminal)." }
try { npm -v } catch { Write-Host "npm no disponible aun (reinicia terminal)." }
try { python --version } catch { Write-Host "python no disponible aun (reinicia terminal)." }
try { psql --version } catch { Write-Host "psql no disponible aun (reinicia terminal)." }

Write-Host "`nInstalacion de prerequisitos finalizada."
