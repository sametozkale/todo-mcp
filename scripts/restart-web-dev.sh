#!/usr/bin/env bash
# Restarts the Flowdo web app dev server on port 3001 (see apps/web package.json "dev").
# Run after verification if the dev server was stopped or port 3001 was freed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:3001 | xargs kill 2>/dev/null || true
  sleep 0.4
fi

pnpm dev:web &
echo "Web dev restarted in background → http://localhost:3001"
