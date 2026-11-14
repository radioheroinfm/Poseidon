# Эпоха 3 — Статус

## Сделано (connection path stage)

- [x] PRELOAD_MAP + ADR-014
- [x] ensure --json + session-ticket mint (unix)
- [x] getGatewayWsUrl → `{ok, wsUrl}` + minted ticket URL
- [x] **get_connection** — ensure + mint + ConnectionInfo
- [x] **setActiveConnectionRoute** / get route
- [x] **get_boot_progress** — фазы ensure/connected/error
- [x] stubs: on* unsub, bool false
- [x] golden trident icon + desktop launcher

## Spike 1 — ещё открыто

- [ ] Mount real Hermes `apps/desktop` renderer
- [ ] onBootProgress event stream (not only poll)
- [ ] Windows path for ticket (python client)
- [ ] Реальный чат через WS

## Готовность к аудиту Жени

Срез: connection path complete. Смоук: Get Connection / WS URL / Probe WS.
