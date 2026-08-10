param(
  [string]$ProjectRoot = "C:\acaipark-sw",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$frontDir = Join-Path $ProjectRoot "acaipark-front"
$logDir = Join-Path $env:LOCALAPPDATA "AcaiPark\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$npmCandidates = @()
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand -and $npmCommand.Source) { $npmCandidates += $npmCommand.Source }
$npmCandidates += "C:\Program Files\nodejs\npm.cmd"
$npmCmd = $npmCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$nodeCandidates = @()
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand -and $nodeCommand.Source) { $nodeCandidates += $nodeCommand.Source }
$nodeCandidates += "C:\Program Files\nodejs\node.exe"
$nodeExe = $nodeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ([string]::IsNullOrWhiteSpace($npmCmd)) {
  throw "No se encontro npm.cmd en PATH. Instala Node.js LTS y vuelve a intentar."
}
if ([string]::IsNullOrWhiteSpace($nodeExe)) {
  throw "No se encontro node.exe. Instala Node.js LTS y vuelve a intentar."
}

$nodeDir = Split-Path $nodeExe -Parent
$pathParts = $env:Path -split ";"
if (-not ($pathParts | Where-Object { $_.Trim().TrimEnd('\').ToLowerInvariant() -eq $nodeDir.Trim().TrimEnd('\').ToLowerInvariant() })) {
  $env:Path = "$nodeDir;$env:Path"
}

try {
  $existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
} catch {
  $existingListener = $null
}

if ($existingListener) {
  Write-Host "Puerto $Port ya en uso (PID $($existingListener.OwningProcess)). No se inicia otra instancia frontend."
  exit 0
}

Push-Location $frontDir
try {
  & $npmCmd run start -- -H 0.0.0.0 -p $Port *>> (Join-Path $logDir "frontend.log")
}
finally {
  Pop-Location
}
