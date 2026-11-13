# Эпоха 3 — Статус

## Сделано

- [x] PRELOAD_MAP черновик (`docs/upstream/PRELOAD_MAP.md`)
- [x] ADR-014: nested `hermesDesktop`
- [x] P0 types + install module
- [x] placeholder: `window.hermesDesktop` P0+
- [x] Rust: `get_gateway_ws_url`, `gateway_ensure`
- [x] UI buttons: Ensure Gateway, WS URL

## Spike 1 — ещё открыто

- [ ] Узнать точный boot path renderer Hermes (какие ключи при первом paint)
- [ ] Подключить build `apps/desktop` как frontend (или iframe/web UI)
- [ ] Реализовать минимальный nested surface без падений на undefined
- [ ] Реальный чат через WS шлюза
- [ ] Discovery шлюза не только 8642 (R3)

## Критерий «Эпоха 3 done»

Чат Hermes в окне Poseidon, сообщения ходят через gateway.
