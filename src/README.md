# Poseidon Source

- `src-tauri/` — Rust backend (Tauri)
- `src/desktop-bridge/` — изоморфный слой совместимости с window.electronAPI
- `src/renderer-placeholder/` — пока заглушка (позже сюда аккуратно подключим React из Hermes)

Главный архитектурный принцип (ADR-007):  
React-рендерер должен оставаться максимально чистым.
