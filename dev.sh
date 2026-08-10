#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACK_DIR="$ROOT_DIR/acaipark-back"
FRONT_DIR="$ROOT_DIR/acaipark-front"

if [[ ! -d "$BACK_DIR" ]]; then
  echo "Error: no existe $BACK_DIR" >&2
  exit 1
fi

if [[ ! -d "$FRONT_DIR" ]]; then
  echo "Error: no existe $FRONT_DIR" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 no está disponible en PATH" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm no está disponible en PATH" >&2
  exit 1
fi

kill_tree() {
  local pid="$1"
  [[ -n "${pid:-}" ]] || return 0

  if command -v pgrep >/dev/null 2>&1; then
    local children
    children="$(pgrep -P "$pid" 2>/dev/null || true)"
    for child in $children; do
      kill_tree "$child"
    done
  else
    local children
    children="$(ps -o pid= --ppid "$pid" 2>/dev/null | tr -d ' ' || true)"
    for child in $children; do
      kill_tree "$child"
    done
  fi

  kill "$pid" 2>/dev/null || true
}

backend_pid=""
front_pid=""

cleanup() {
  set +e
  kill_tree "${front_pid:-}"
  kill_tree "${backend_pid:-}"
  wait "${front_pid:-}" 2>/dev/null || true
  wait "${backend_pid:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Iniciando backend (FastAPI/uvicorn) en $BACK_DIR ..."
(cd "$BACK_DIR" && exec ./build.sh) &
backend_pid="$!"

echo "Iniciando front (Next.js) en $FRONT_DIR ..."
(cd "$FRONT_DIR" && exec npm run dev) &
front_pid="$!"

echo "Backend PID: $backend_pid | Front PID: $front_pid"
echo "Ctrl+C para detener ambos."

set +e
wait -n "$backend_pid" "$front_pid"
exit_code="$?"
set -e

echo "Uno de los procesos terminó (exit=$exit_code). Deteniendo el resto..."
exit "$exit_code"
