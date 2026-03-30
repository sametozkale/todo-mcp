#!/usr/bin/env bash
# Restarts the Yalp web app dev server on port 3001 (see apps/web package.json "dev").
# Run after verification if the dev server was stopped or port 3001 was freed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:3001 -sTCP:LISTEN | xargs kill 2>/dev/null || true
  sleep 0.4
fi

# Wipe outputs that often desync (HTML points at layout.css / chunks that no longer exist → unstyled page / 404 CSS).
rm -rf \
  "apps/web/.next" \
  "apps/web/.turbo" \
  "apps/web/node_modules/.cache" \
  "node_modules/.cache/next" \
  "node_modules/.cache/turbo" \
  2>/dev/null || true

# Use direct `next dev` (no Turbo) so HTML ↔ .next/static/css stay in sync (avoids layout.css 404 + unstyled pages).
pnpm dev:web:direct &
echo "Web dev restarted in background → http://localhost:3001"
