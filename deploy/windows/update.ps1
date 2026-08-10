$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\..\.."
git pull
docker compose up -d --build
docker image prune -f
