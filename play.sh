#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "  TamaRagna - raise a Ragnarok monster"
echo "  -----------------------------------"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [X] Node.js 20 or newer is required. Install it from https://nodejs.org"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "  [X] Node.js 20 or newer is required. Found $(node --version)"
  exit 1
fi

if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
  echo "  TamaRagna is already running. Opening it..."
  if command -v open >/dev/null 2>&1; then open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  fi
  exit 0
fi

if [ ! -f node_modules/next/package.json ]; then
  echo "  [1/3] Installing dependencies. This only happens once..."
  npm install --no-audit --no-fund
else
  echo "  [1/3] Dependencies ready."
fi

if [ ! -f .next/BUILD_ID ] || [ ! -f data/generated/species.json ]; then
  echo "  [2/3] Building the game. This only happens once..."
  npm run build
else
  echo "  [2/3] Build ready."
fi

npm run db:unlock >/dev/null 2>&1 || true

echo "  [3/3] Starting the server at http://localhost:3000"
echo

if [ "${TAMARAGNA_NO_BROWSER:-0}" != "1" ]; then
  (
    for _ in $(seq 1 240); do
      if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
        if command -v open >/dev/null 2>&1; then open http://localhost:3000
        elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
        fi
        break
      fi
      sleep 1
    done
  ) &
fi

echo "  Press Ctrl+C to stop the game."
echo
npm start
