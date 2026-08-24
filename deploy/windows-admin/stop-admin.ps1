param([string]$ProjectRoot = "C:\Users\This\acai-sw-admin")

$ErrorActionPreference = "Stop"
& docker compose -f (Join-Path $ProjectRoot "docker-compose.yml") stop backend frontend
if ($LASTEXITCODE -ne 0) { throw "No se pudo detener ACAI PARK Administrador." }

# PostgreSQL stays running because the cashier also uses the shared database.
