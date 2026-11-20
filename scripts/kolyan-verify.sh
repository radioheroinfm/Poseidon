#!/usr/bin/env bash
# Poseidon — verification run for kolyan-patch-01 (Linux / macOS).
# Usage (from the repo root):  bash scripts/kolyan-verify.sh
# Writes the full log to logs/kolyan-verify-<utc timestamp>.log — attach it to the journal.
set -u -o pipefail

mkdir -p logs
LOG="logs/kolyan-verify-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee "$LOG") 2>&1

echo "== environment"
echo "date:   $(date -u +%FT%TZ)"
echo "host:   $(uname -a)"
echo "git:    $(git rev-parse --short HEAD 2>/dev/null) ($(git rev-parse --abbrev-ref HEAD 2>/dev/null))"
echo "node:   $(node --version 2>&1)"
echo "npm:    $(npm --version 2>&1)"
echo "rustc:  $(rustc --version 2>&1)"
echo "cargo:  $(cargo --version 2>&1)"

FAILED=()
run() {
  local name="$1"; shift
  echo; echo "=== $name"
  if "$@"; then echo "[PASS] $name"; else echo "[FAIL] $name"; FAILED+=("$name"); fi
}

[ -d node_modules ] || run "npm install" npm install
run "bridge tests (node, fake Tauri host)" npm run test:bridge
run "tsc --noEmit" npx tsc --noEmit
run "cargo test (ws_bridge loopback tests included)" bash -c 'cd src-tauri && cargo test --all-targets'
run "cargo clippy (warnings allowed for now)" bash -c 'cd src-tauri && cargo clippy --all-targets'

echo
echo "=============== RESULT"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "ALL AUTOMATED STEPS PASSED"
else
  echo "FAILED STEPS:"; printf ' - %s\n' "${FAILED[@]}"
fi
cat <<'MANUAL'

=============== MANUAL SMOKE (needs a running Hermes gateway) — do this next
 1. npm run dev:hermes-ui        # starts Vite + `tauri dev` with the Hermes UI
 2. Wait ~10 s, then look at the log:  tail -n 80 logs/poseidon-ui.log
    - first lines must contain:   [poseidon] bootstrap kolyan-patch-01 installed
    - the FIRST '[js-error]' / '[js-unhandled-rejection]' line is the white-screen cause
    - '[trace] MISS ...' lines = hermesDesktop keys the UI needs (this is BOOT_TRACE)
    - '[trace] NET-fetch|NET-xhr ...' lines = other loopback transports (Origin problem, W5)
    - '[trace] WS-SHIM open ...' then NO '[ws-shim] open failed' = the socket path works
 3. Send one chat message, then: grep -c 'WS-SHIM' logs/poseidon-ui.log
 4. Attach logs/kolyan-verify-*.log, logs/poseidon-ui.log and a screenshot of the window.
MANUAL
[ ${#FAILED[@]} -eq 0 ]
