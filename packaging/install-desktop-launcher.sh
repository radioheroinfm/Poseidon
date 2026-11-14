#!/usr/bin/env bash
# Install Poseidon desktop launcher for the current user (Linux).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer release binary, fall back to debug / common cargo target paths
CANDIDATES=(
  "${CARGO_TARGET_DIR:-}/release/poseidon-desktop"
  "$HOME/build/cache/cargo-target/release/poseidon-desktop"
  "$ROOT/src-tauri/target/release/poseidon-desktop"
  "$HOME/build/cache/cargo-target/debug/poseidon-desktop"
  "$ROOT/src-tauri/target/debug/poseidon-desktop"
)

BIN=""
for c in "${CANDIDATES[@]}"; do
  if [[ -n "$c" && -x "$c" ]]; then
    BIN="$c"
    break
  fi
done

if [[ -z "$BIN" ]]; then
  echo "No poseidon-desktop binary found. Build first:"
  echo "  cd $ROOT && npm run tauri build"
  exit 1
fi

echo "Using binary: $BIN"

APP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
BIN_LINK="$HOME/.local/bin/poseidon-desktop"

mkdir -p "$APP_DIR" "$ICON_DIR" "$HOME/.local/bin"

# Icon
ICON_SRC="$ROOT/src-tauri/icons/128x128@2x.png"
if [[ -f "$ROOT/src-tauri/icons/icon.png" ]]; then
  ICON_SRC="$ROOT/src-tauri/icons/icon.png"
fi
cp "$ICON_SRC" "$ICON_DIR/poseidon-desktop.png"

# Wrapper in ~/.local/bin so Exec=poseidon-desktop works
cat > "$BIN_LINK" << WRAP
#!/usr/bin/env bash
exec "$BIN" "\$@"
WRAP
chmod +x "$BIN_LINK"

# Desktop entry
cp "$ROOT/packaging/poseidon.desktop" "$APP_DIR/poseidon.desktop"
# Absolute Icon path fallback for some desktops
sed -i "s|^Icon=.*|Icon=$ICON_DIR/poseidon-desktop.png|" "$APP_DIR/poseidon.desktop"

# Desktop shortcut (optional)
if [[ -d "$HOME/Desktop" ]]; then
  cp "$APP_DIR/poseidon.desktop" "$HOME/Desktop/poseidon.desktop"
  chmod +x "$HOME/Desktop/poseidon.desktop" 2>/dev/null || true
  echo "Desktop shortcut: $HOME/Desktop/poseidon.desktop"
fi

update-desktop-database "$APP_DIR" 2>/dev/null || true

echo "Installed launcher: $APP_DIR/poseidon.desktop"
echo "Command: $BIN_LINK"
echo "Open from app menu as «Poseidon» or run: poseidon-desktop"
