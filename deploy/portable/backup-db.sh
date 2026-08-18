#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
BACKUP_PATH="${1:-$ROOT_DIR/acaipark-back/acaipark_dev.backup}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: Docker no está disponible en PATH." >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-acai_prod}"
POSTGRES_USER="${POSTGRES_USER:-acai_user}"

docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db

echo "Esperando a que PostgreSQL esté listo..."
until docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$BACKUP_PATH"

echo "Backup guardado en $BACKUP_PATH"
