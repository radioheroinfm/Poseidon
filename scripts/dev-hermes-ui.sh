#!/usr/bin/env bash
# Spike 1: Hermes apps/desktop Vite + Poseidon Tauri shell
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HERMES_DESKTOP="${HERMES_DESKTOP:-$HOME/.hermes/hermes-agent/apps/desktop}"

echo "Poseidon root: $ROOT"
echo "Hermes desktop: $HERMES_DESKTOP"

if [[ ! -d "$HERMES_DESKTOP" ]]; then
  echo "Hermes desktop not found at $HERMES_DESKTOP"
  echo "Set HERMES_DESKTOP=/path/to/apps/desktop"
  exit 1
fi

export POSEIDON_ROOT="$ROOT"
export POSEIDON_HERMES_UI=1

# Start Vite renderer if not already up
if ! curl -sf -o /dev/null http://127.0.0.1:5174/; then
  echo "Starting Hermes vite on 127.0.0.1:5174 ..."
  (
    cd "$HERMES_DESKTOP"
    # Prefer npm run dev:renderer from package.json
    npm run dev:renderer
  ) &
  VITE_PID=$!
  trap 'kill $VITE_PID 2>/dev/null || true' EXIT
  echo "Waiting for Vite..."
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null http://127.0.0.1:5174/; then
      echo "Vite is up"
      break
    fi
    sleep 1
  done
else
  echo "Vite already running on 5174"
fi

cd "$ROOT"
# Tauri 2: --config merges/overrides
npm run tauri -- dev --config configs/tauri.hermes-dev.json
