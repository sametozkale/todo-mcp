#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist-app"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "dist-app bulunamadi: $DIST_DIR"
  echo "Once macOS build al: pnpm --filter desktop build:mac:release"
  exit 1
fi

shopt -s nullglob
apps=("$DIST_DIR"/mac-*/Yalp.app "$DIST_DIR"/Yalp.app)
dmgs=("$DIST_DIR"/*.dmg)
shopt -u nullglob

if [[ ${#apps[@]} -eq 0 && ${#dmgs[@]} -eq 0 ]]; then
  echo "Dogrulanacak Yalp.app veya .dmg bulunamadi: $DIST_DIR"
  exit 1
fi

for app in "${apps[@]}"; do
  if [[ -d "$app" ]]; then
    echo ">> codesign kontrolu: $app"
    codesign --verify --deep --strict --verbose=2 "$app"
    echo ">> gatekeeper kontrolu: $app"
    spctl -a -vv -t exec "$app"
  fi
done

for dmg in "${dmgs[@]}"; do
  if [[ -f "$dmg" ]]; then
    echo ">> stapler kontrolu: $dmg"
    xcrun stapler validate "$dmg"
  fi
done

echo "macOS artifact kontrolleri basarili."
