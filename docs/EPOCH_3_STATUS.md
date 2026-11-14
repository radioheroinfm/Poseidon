# Эпоха 3 — Статус

## Сделано

- [x] PRELOAD_MAP черновик (`docs/upstream/PRELOAD_MAP.md`)
- [x] ADR-014: nested `hermesDesktop`
- [x] P0 types + install module
- [x] placeholder: `window.hermesDesktop` P0+
- [x] Rust: `get_gateway_ws_url`, `gateway_ensure`
- [x] UI buttons: Ensure Gateway, WS URL
- [x] Live: `ws://127.0.0.1:9119` after Ensure Gateway (dynamic port)
- [x] Stubs fixed: `on*` → unsubscribe fn; bool flags → false (Женя №6)
- [x] Gateway stderr → warn! drain
- [x] Probe WS button in placeholder

## Spike 1 — ещё открыто

- [ ] Boot trace: какие ключи при первом paint чата (локальный Hermes Electron)
- [ ] Подключить build `apps/desktop` как frontend
- [ ] Реальный чат через WS (протокол/токен)
- [ ] Discovery шлюза как у апстрима (не только READY/порт)

## Критерий «Эпоха 3 done»

Чат Hermes в окне Poseidon, сообщения ходят через gateway.
