#!/usr/bin/env bash
set -euo pipefail

# Load local environment if present (DATABASE_URL, etc.).
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Warning: no .env and DATABASE_URL not set; defaulting to postgresql:///girona_dev (local Unix socket)." >&2
fi

exec python3 -m uvicorn app.main:app --reload
