#!/usr/bin/env bash
set -euo pipefail

# Load local environment if present (DATABASE_URL, etc.).
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
elif [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Warning: no .env and DATABASE_URL not set; defaulting to postgresql:///acai_dev (local Unix socket)." >&2
fi

if [[ -x .venv/Scripts/python.exe ]]; then
  PYTHON_CMD=.venv/Scripts/python.exe
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON_CMD=python
else
  echo "Error: Python no esta disponible en PATH" >&2
  exit 1
fi

exec "$PYTHON_CMD" -m uvicorn app.main:app --reload
