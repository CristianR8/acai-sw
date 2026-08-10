param(
  [string]$AdminUser = "postgres",
  [string]$AdminPassword = "",
  [string]$NewUser = "girona_user",
  [string]$NewPassword = "change_me",
  [string]$NewDatabase = "girona_prod",
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432
)

$ErrorActionPreference = "Stop"

function Resolve-PgTool([string]$toolName) {
  $cmd = Get-Command $toolName -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    "C:\Program Files\PostgreSQL\18\bin\$toolName.exe",
    "C:\Program Files\PostgreSQL\17\bin\$toolName.exe",
    "C:\Program Files\PostgreSQL\16\bin\$toolName.exe",
    "C:\Program Files\PostgreSQL\15\bin\$toolName.exe",
    "C:\Program Files\PostgreSQL\14\bin\$toolName.exe"
  )

  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }

  return $null
}

function Invoke-PgCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$CaptureOutput
  )

  if ($CaptureOutput) {
    $output = & $Executable @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
      $details = ($output | Out-String).Trim()
      if ([string]::IsNullOrWhiteSpace($details)) { $details = "Sin detalles." }
      throw "Fallo al ejecutar '$Executable': $details"
    }
    return $output
  }

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo al ejecutar '$Executable' (codigo $LASTEXITCODE)."
  }
}

$psqlPath = Resolve-PgTool "psql"
$createdbPath = Resolve-PgTool "createdb"
if (!$psqlPath -or !$createdbPath) {
  throw "No se encontro psql/createdb. Verifica que PostgreSQL este instalado."
}

$quotedNewUser = '"' + ($NewUser -replace '"', '""') + '"'
$escapedNewUser = $NewUser -replace "'", "''"
$escapedNewPassword = $NewPassword -replace "'", "''"
$escapedNewDatabase = $NewDatabase -replace "'", "''"

$createUserSql = @"
DO
`$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$escapedNewUser') THEN
    CREATE ROLE $quotedNewUser LOGIN PASSWORD '$escapedNewPassword';
  ELSE
    ALTER ROLE $quotedNewUser WITH LOGIN PASSWORD '$escapedNewPassword';
  END IF;
END
`$`$;
"@

$originalPgPassword = $env:PGPASSWORD
try {
  if (-not [string]::IsNullOrWhiteSpace($AdminPassword)) {
    $env:PGPASSWORD = $AdminPassword
  }

  Invoke-PgCommand -Executable $psqlPath -Arguments @(
    "-h", $PgHost,
    "-p", "$PgPort",
    "-U", $AdminUser,
    "-d", "postgres",
    "-v", "ON_ERROR_STOP=1",
    "-c", $createUserSql
  )

  $dbExistsRaw = Invoke-PgCommand -Executable $psqlPath -CaptureOutput -Arguments @(
    "-h", $PgHost,
    "-p", "$PgPort",
    "-U", $AdminUser,
    "-d", "postgres",
    "-tAc", "SELECT 1 FROM pg_database WHERE datname = '$escapedNewDatabase'"
  )
  $dbExists = ($dbExistsRaw | Out-String).Trim()

  if ($dbExists -ne "1") {
    Invoke-PgCommand -Executable $createdbPath -Arguments @(
      "-h", $PgHost,
      "-p", "$PgPort",
      "-U", $AdminUser,
      "-O", $NewUser,
      $NewDatabase
    )
  }
}
catch {
  $msg = $_.Exception.Message
  if ($msg -match "password authentication failed|autentificaci.n password fall") {
    throw "Password incorrecta para usuario admin '$AdminUser' en PostgreSQL."
  }
  throw
}
finally {
  if ($null -eq $originalPgPassword) {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  } else {
    $env:PGPASSWORD = $originalPgPassword
  }
}

Write-Host "Base lista: $NewDatabase / usuario: $NewUser"
