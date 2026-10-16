#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "${api_pid:-}" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  if [[ -n "${web_pid:-}" ]]; then kill "$web_pid" 2>/dev/null || true; fi
}
trap cleanup INT TERM EXIT

uv run --project services/api uvicorn policymap_api.main:app \
  --reload --reload-dir services/api/src --host 0.0.0.0 --port 8000 &
api_pid=$!

npm run dev:web &
web_pid=$!

printf 'PolicyMap API: http://localhost:8000/docs\n'
printf 'PolicyMap web: http://localhost:5173\n'

wait "$api_pid" "$web_pid"
