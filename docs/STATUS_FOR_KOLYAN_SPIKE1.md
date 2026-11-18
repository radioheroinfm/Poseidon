# Срез для Коляна — Spike 1 (2026-11-18)

**HEAD:** `3ca51fa` · repo `radioheroinfm/Poseidon`

## Что уже доказано на cathedral

| Слой | Факт |
|------|------|
| ensure --json + session-ticket | live |
| Canonical WS dial | `101` + `hermes-gateway-v1` + `gateway.ready` |
| Rust WsBridge | Connect → Ping (`ok:true`) → Close |
| ADR-015 | browser Origin → 1006; транспорт в Rust |
| Zhenya #8 | принят; CI зелёный после фиксов |

## Spike 1 mount (в работе)

- `npm run dev:hermes-ui` → Vite Hermes `:5174` + Tauri shell
- `poseidon-bootstrap.js` → `window.hermesDesktop` + `PoseidonGatewaySocket`
- Delayed inject (Tauri 2.12: нет `WebviewWindow::on_page_load`)
- `configs/tauri.hermes-dev.json` · CSP `null` · debug DevTools

**Симптом:** при первом прогоне — белый экран / путаница с окном Electron; compile fix `on_page_load` только что на main.

## Архитектурный риск (нужен взгляд стратега)

1. **socketFactory** — если upstream `openGatewaySocket` не читает `__POSEIDON_SOCKET_FACTORY__`, UI снова упрётся в Origin/1006. Нужен тонкий патч или Vite alias, без форка половины desktop.
2. **Паритет hermesDesktop** — P0 + stubs; boot-trace Hermes может требовать ещё методы до «чата».
3. **Два runtime** — Vite `dev:renderer` ок; нельзя случайно поднимать `dev:electron`.

## Не трогаем

- Перепись UI Hermes (берём `apps/desktop` as-is)
- Windows ticket path (unix-first)

## Просьба Коляну

Вердикт: идём в (A) минимальный патч `openGatewaySocket` → factory, или (B) полный shim-модуль через Vite alias, или (C) свой тонкий chat shell на `PoseidonGatewaySocket` до полного mount?

Манифест: **ДЕЛАЕМ КРАСИВО**, без лжи про зелёный экран.
