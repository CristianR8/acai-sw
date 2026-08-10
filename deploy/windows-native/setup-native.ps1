param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [string]$PgUser = "girona_user",
  [string]$PgPassword = "change_me",
  [string]$PgDatabase = "girona_prod",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $ProjectRoot "acaipark-back"
$frontDir = Join-Path $ProjectRoot "acaipark-front"

if (!(Test-Path $backendDir)) { throw "No existe $backendDir" }
if (!(Test-Path $frontDir)) { throw "No existe $frontDir" }

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo comando: $Executable $($Arguments -join ' ')"
  }
}

function Test-CommandCandidate {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
  if (!(Test-Path $Path)) { return $false }

  $out = & $Path --version 2>&1
  if ($LASTEXITCODE -ne 0) { return $false }
  $text = ($out | Out-String)
  if ($text -match "Microsoft Store") { return $false }
  return $true
}

function Resolve-PythonExe {
  $candidates = @(
    (Join-Path $env:LocalAppData "Programs\Python\Python312\python.exe"),
    "C:\Program Files\Python312\python.exe"
  )

  foreach ($name in @("python.exe", "python")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
      $candidates += $cmd.Source
    }
  }

  $seen = @{}
  foreach ($candidate in $candidates) {
    if ($seen.ContainsKey($candidate)) { continue }
    $seen[$candidate] = $true
    if (Test-CommandCandidate -Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Resolve-NpmCmd {
  $candidates = @(
    "C:\Program Files\nodejs\npm.cmd"
  )

  foreach ($name in @("npm.cmd", "npm")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
      $candidates += $cmd.Source
    }
  }

  $seen = @{}
  foreach ($candidate in $candidates) {
    if ($seen.ContainsKey($candidate)) { continue }
    $seen[$candidate] = $true
    if (Test-CommandCandidate -Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Resolve-NodeExe {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe"
  )

  foreach ($name in @("node.exe", "node")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) {
      $candidates += $cmd.Source
    }
  }

  $seen = @{}
  foreach ($candidate in $candidates) {
    if ($seen.ContainsKey($candidate)) { continue }
    $seen[$candidate] = $true
    if (Test-CommandCandidate -Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Ensure-PathContains {
  param([Parameter(Mandatory = $true)][string]$DirectoryPath)
  if (!(Test-Path $DirectoryPath)) { return }
  $parts = $env:Path -split ";"
  foreach ($part in $parts) {
    if ($part.Trim().TrimEnd("\").ToLowerInvariant() -eq $DirectoryPath.Trim().TrimEnd("\").ToLowerInvariant()) {
      return
    }
  }
  $env:Path = "$DirectoryPath;$env:Path"
}

Write-Host "[1/6] Validando herramientas..."
$pythonExe = Resolve-PythonExe
$npmCmd = Resolve-NpmCmd
$nodeExe = Resolve-NodeExe

if (!$pythonExe) {
  throw "Python no disponible. Ejecuta install-prereqs.ps1 o agrega Python 3.12 al PATH."
}
if (!$npmCmd) {
  throw "npm/node no disponible. Ejecuta install-prereqs.ps1 o agrega Node.js al PATH."
}
if (!$nodeExe) {
  throw "node no disponible. Ejecuta install-prereqs.ps1 o agrega Node.js al PATH."
}

Ensure-PathContains -DirectoryPath (Split-Path $nodeExe -Parent)

Write-Host "[2/6] Backend: creando virtualenv e instalando dependencias..."
Push-Location $backendDir
try {
  if (!(Test-Path ".venv")) {
    Invoke-Native -Executable $pythonExe -Arguments @("-m", "venv", ".venv")
  }
  if (!(Test-Path ".\.venv\Scripts\python.exe")) {
    throw "No se pudo crear .venv correctamente en $backendDir"
  }

  Invoke-Native -Executable ".\.venv\Scripts\python.exe" -Arguments @("-m", "pip", "install", "--upgrade", "pip")
  Invoke-Native -Executable ".\.venv\Scripts\pip.exe" -Arguments @("install", "-r", "requirements.txt")

  $envPath = Join-Path $backendDir ".env"
  if (!(Test-Path $envPath)) {
    Copy-Item ".env.example" $envPath -Force
  }

  $pgUserEncoded = [System.Uri]::EscapeDataString($PgUser)
  $pgPasswordEncoded = [System.Uri]::EscapeDataString($PgPassword)
  $databaseUrl = "postgresql://${pgUserEncoded}:${pgPasswordEncoded}@${PgHost}:${PgPort}/${PgDatabase}"
  $envContent = Get-Content $envPath
  $envContent = $envContent -replace '^DATABASE_URL=.*$', "DATABASE_URL=$databaseUrl"
  $envContent = $envContent -replace '^AUTO_CREATE_TABLES=.*$', 'AUTO_CREATE_TABLES=1'
  Set-Content -Path $envPath -Value $envContent -Encoding UTF8
}
finally {
  Pop-Location
}

Write-Host "[3/6] Frontend: instalando dependencias y compilando..."
Push-Location $frontDir
try {
  if (!(Test-Path ".env.production")) {
    if (Test-Path ".env.production.example") {
      Copy-Item ".env.production.example" ".env.production" -Force
    } else {
      @(
        "BACKEND_URL=http://127.0.0.1:8000",
        "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000"
      ) | Set-Content -Path ".env.production"
    }
  }
  Invoke-Native -Executable $npmCmd -Arguments @("ci")
  Invoke-Native -Executable $npmCmd -Arguments @("run", "build")
}
finally {
  Pop-Location
}

Write-Host "[4/6] Creando carpeta de logs..."
New-Item -ItemType Directory -Force -Path (Join-Path $ProjectRoot "logs") | Out-Null

Write-Host "[5/6] Prueba de arranque backend en segundo plano (10s)..."
$backendScript = Join-Path $ProjectRoot "deploy\windows-native\start-backend.ps1"
$job = Start-Job -ScriptBlock {
  param($scriptPath, $root)
  powershell -ExecutionPolicy Bypass -File $scriptPath -ProjectRoot $root -Port 8000
} -ArgumentList $backendScript, $ProjectRoot

Start-Sleep -Seconds 10
$jobRunning = (Get-Job -Id $job.Id).State -eq "Running"
if ($jobRunning) {
  # PowerShell 5.1 does not support -Force on Stop-Job.
  Stop-Job -Id $job.Id | Out-Null
}
Receive-Job -Id $job.Id -Keep | Out-Null
Remove-Job -Id $job.Id -Force

Write-Host "[6/6] Setup finalizado."
Write-Host "Siguiente paso: ejecutar register-startup-tasks.ps1 para autoarranque."
