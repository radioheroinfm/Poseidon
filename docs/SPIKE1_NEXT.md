# Spike 1 — что дальше (2026-11-20)

## Уже доказано
- ensure --json + session-ticket + Rust WS (101, gateway.ready, ping)
- Hermes UI грузится в Tauri (Vite :5174)
- localSkin Proxy crash снят
- get_connection → state:ready, apiOrigin живой
- get_gateway_ws_url → ok + ticket URL

## Блокеры сейчас
1. **WebKitWebProcess crash** (Linux) — окно умирает
2. **`#root` пустой** (innerHTML `""`) — React не рисует shell
3. **Нет `gateway WS dial`** — UI не доходит до openGatewaySocket

## Порядок работ
### A. Диагностика за 10 минут (Толян)
```bash
# 1) Тот же UI в обычном Chrome (без Tauri)
xdg-open http://127.0.0.1:5174/

# 2) В Poseidon Console после 6с:
document.getElementById('root')?.innerHTML?.slice(0,500)
document.querySelector('#root')?.childElementCount

# 3) WebKit soft
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
export LIBGL_ALWAYS_SOFTWARE=1
npm run dev:hermes-ui
```
- Chrome рисует Hermes → проблема в WebKit/Tauri host  
- Chrome тоже пустой → проблема в boot/bridge shape, не в WebKit

### B. Код (Гриша)
1. `get_boot_progress` после ready connection → `ready:true` (не залипать на ensure)
2. Сверить `HermesConnection` с upstream типом (baseUrl, mode, connectionId, token)
3. Логи stub-path: любой `hermesDesktop.*` вызов в append_ui_log (boot-trace)
4. WebKit: не трогать shim до стабилизации crash; проверить без gateway WS shim (feature flag)

### C. Критерий Spike 1 done
`docs/reports/SPIKE1_RESULT.md`: скрин чата + кадры gateway-ws-frame туда-обратно + лог

## Не делаем сейчас
- Свой chat UI (вариант C Коляна)
- Патч upstream apps/desktop
