param(
  [string]$ProjectRoot = "C:\acaipark-sw"
)

$ErrorActionPreference = "Stop"

Write-Host "Instalacion asistida ACAIPARK (sin Docker)"
Write-Host "Proyecto: $ProjectRoot"

function Read-SecretText {
  param([string]$Prompt)
  $secure = Read-Host -Prompt $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$pgAdminUser = Read-Host "Usuario admin Postgres (default: postgres)"
if ([string]::IsNullOrWhiteSpace($pgAdminUser)) { $pgAdminUser = "postgres" }

$pgUser = Read-Host "Usuario app DB (default: acai_user)"
if ([string]::IsNullOrWhiteSpace($pgUser)) { $pgUser = "acai_user" }

$pgDb = Read-Host "Base de datos (default: acai_prod)"
if ([string]::IsNullOrWhiteSpace($pgDb)) { $pgDb = "acai_prod" }

$pgPassword = Read-SecretText -Prompt "Password DB para usuario '$pgUser'"
if ([string]::IsNullOrWhiteSpace($pgPassword)) {
  throw "Debes ingresar password para la base de datos."
}

$pgAdminPassword = Read-SecretText -Prompt "Password para usuario admin '$pgAdminUser'"
if ([string]::IsNullOrWhiteSpace($pgAdminPassword)) {
  throw "Debes ingresar password para usuario admin '$pgAdminUser'."
}

$createDb = Join-Path $ProjectRoot "deploy\windows-native\create-postgres-db.ps1"
$setup = Join-Path $ProjectRoot "deploy\windows-native\setup-native.ps1"
$register = Join-Path $ProjectRoot "deploy\windows-native\register-startup-tasks.ps1"
$launcher = Join-Path $ProjectRoot "deploy\windows-native\launcher.ps1"

& $createDb -AdminUser $pgAdminUser -AdminPassword $pgAdminPassword -NewUser $pgUser -NewPassword $pgPassword -NewDatabase $pgDb
& $setup -ProjectRoot $ProjectRoot -PgUser $pgUser -PgPassword $pgPassword -PgDatabase $pgDb
try {
  & $register -ProjectRoot $ProjectRoot -RunAsUser $env:USERNAME
} catch {
  Write-Host "Aviso: no se pudieron registrar tareas de autoarranque. Continuando..."
}
& $launcher -ProjectRoot $ProjectRoot

Write-Host "Instalacion completada. La app ya deberia estar abierta."
