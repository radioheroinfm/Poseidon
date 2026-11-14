# Packaging helpers (Linux)

## Icons
Source: `assets/icon-source-1024.png`  
Tauri set: `src-tauri/icons/`

Regenerate sizes after editing the source:
```bash
convert assets/icon-source-1024.png -resize 32x32 src-tauri/icons/32x32.png
# … or re-run the icon script from the commit message
```

## Desktop launcher
```bash
# 1) build release binary once
npm run tauri build

# 2) install menu + Desktop shortcut
./packaging/install-desktop-launcher.sh
```

The script links the newest found `poseidon-desktop` binary and installs icon + `.desktop` entry.
