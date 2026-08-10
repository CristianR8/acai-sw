$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\.."

if (!(Test-Path ".env")) {
  Copy-Item ".env.deploy.example" ".env"
  Write-Host "Se creó .env desde .env.deploy.example. Edita POSTGRES_PASSWORD y credenciales Factus antes de seguir."
}

docker compose up -d --build

docker compose ps

Write-Host "App lista en http://localhost:3000"
