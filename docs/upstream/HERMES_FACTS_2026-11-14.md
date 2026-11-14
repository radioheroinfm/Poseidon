# ОТЧЁТ: факты из локального hermes-agent (проект Poseidon)

Репозиторий: `/home/thomas/.hermes/hermes-agent` (remote `https://github.com/NousResearch/hermes-agent.git`)
Дата съёма: 2026-11-14. Только чтение кода, чужой код не менялся.

## VERSION

- `git rev-parse HEAD` → `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19` (detached HEAD, «no branch»)
- `git describe --tags --always` → `v0.23.0`
- `git log -1 --oneline` → `2bd378ed1b test(desktop-e2e): find the p2 draft tab by its title, not by its status dot`
- Working tree грязный (напр. `D tests/tools/test_tts_piper.py`) — не чистый checkout.
- Cross-check: живой шлюз на машине (`~/.hermes/gateway_state.json`, pid 3028) рапортует `code_sha: 2bd378ed…`, `code_version: "0.23.0"` — совпадает с HEAD.

## WS_URL_SHAPE — формат `getGatewayWsUrl`

- IPC-хендлеры: `apps/desktop/electron/main.ts:14181` — `hermes:gateway:ws-url` → `gatewayWsUrlIpcResult(() => freshGatewayWsUrl(profile, sender.id))`; registry-вариант `hermes:gateway:ws-url-for` → `main.ts:14998`.
- Preload проксирует как есть: `electron/preload.ts:60` — `getGatewayWsUrl: profile => ipcRenderer.invoke('hermes:gateway:ws-url', profile)`.
- **Return type** (`electron/connection-config.ts:236-246`):
  `{ ok: true, wsUrl: string } | { ok: false, error: string, needsOauthLogin?: true }`.
  В shared-типе renderer (`apps/shared/src/websocket-url.ts:18-21`, `GatewayWsUrlResult`) допустим ещё и голый `string`.
- **Сборка URL** (`connection-config.ts:91-105`):
  - `buildGatewayWsUrl(baseUrl, token)` → `` `${wss|ws}://${host}${prefix}/api/ws?token=${encodeURIComponent(token)}` ``
  - `buildGatewayWsUrlWithTicket(baseUrl, ticket)` → тот же путь, `?ticket=…`
  - `prefix` = pathname baseUrl без trailing slashes (сохраняется reverse-proxy subpath). Путь всегда `/api/ws`.
- **Local spawn — статического tokenа в URL нет.** Кэшированный дескриптор (`electron/local-gateway.ts:254`):
  `wsUrl = ws://<api_origin>/api/ws?native_dial=unminted`, `authMode: 'native'`, `token: ''`.
  Реальный dial-URL mintится на каждый connect в `freshGatewayWsUrl` (`main.ts:7581`) через `localGatewayDial` → `mintLocalGatewayTicket` (`local-gateway.ts:625`):
  - unix-сокет `~/.hermes/gateway.sock` (или pointer `gateway.sock.path` → `hermes-gw-<sha256(home)[:16]>/control.sock`);
  - запрос одной JSON-строкой: `{protocol:1, id:1, verb:'session-ticket', params:{profile_id, instance_id, purpose:'interactive', scope:'host'}}`;
  - ответ валидируется по `grant.instance_id` / `grant.profile_id` / `grant.ticket`;
  - на win32 — через `pythonTicketClient`.
  Далее `localGatewayDials.prepare` (`local-gateway.ts:353-355`) ставит `native_dial=<crypto.randomUUID()>` (одноразовый nonce, TTL 25 с, максимум 100 pending) и дописывает `&ticket=<…>`.
- **Пример реального local URL на этой машине** (шлюз слушает `127.0.0.1:55057`, pid 3028):
  - dial: `ws://127.0.0.1:55057/api/ws?native_dial=<uuid>&ticket=<one-use>`
  - кэшированный дескриптор: `ws://127.0.0.1:55057/api/ws?native_dial=unminted`
- Remote: token-режим → `…/api/ws?token=…`; OAuth → `…/api/ws?ticket=…` (одноразовый, TTL ~30 с; re-mint перед каждым connect — комментарий `main.ts:7575-7580`).
- Renderer: `src/api/client.ts:357` видит `native_dial` в URL → `canonical` wire, ticket уходит в subprotocol сокета.

## BOOT_TRACE — ключи hermesDesktop при первом чате

Вариант A (DevTools + прокси-обёртка над `window.hermesDesktop`) **не выполнялся**: сессия headless (`DISPLAY` пуст; бинарник Xvfb есть, но Desktop GUI с DevTools в этой сессии не поднимался). Вариант B — статический анализ:

- `window.hermesDesktop` экспонируется один раз через `contextBridge.exposeInMainWorld` (`electron/preload.ts:32`). **166 top-level ключей** (извлечены парсингом блока). Ключевые: `getConnection`, `getConnectionFor`, `getGatewayWsUrl`, `getGatewayWsUrlFor`, `getPluginWsUrl`, `getBootProgress`, `onBootProgress`, `revalidateConnection`, `setActiveConnectionRoute`, `profile`, `windowControls`, `getProfileRoutes`.
- Boot-последовательность в `src/app/gateway/hooks/use-gateway-boot.ts`, функция `boot()` (стр. 1525):
  1. `desktop.onBootProgress(cb)` + `desktop.getBootProgress()` (стр. 1043-1055)
  2. `getWindowBackend(true)` → `desktop.getConnectionFor({connectionId, profile})` (registry) или `desktop.getConnection(profile)` (стр. 748-769, 1540) — IPC `hermes:connection[-for]`; main при этом гоняет `hermes gateway ensure --json`
  3. `desktop.profile.getDefault()/get()` (lookupPrimaryProfile, стр. 760/787); `publish(conn)` → `desktop.setActiveConnectionRoute({connectionId, profile, registryScoped})` (стр. 324-332)
  4. `resolveDesktopGatewayWsUrl` (`src/lib/gateway-ws-url.ts`) → `desktop.getGatewayWsUrl(profile)` или `getGatewayWsUrlFor(...)` (стр. 1596)
  5. `gateway.connect(wsUrl)`: local — `connectInitialGateway` (8 попыток × 3 с, re-mint перед каждой, стр. 1615-1640); remote — один dial (стр. 1614)
  6. пост-коннект: `refreshHermesConfig`, `refreshSessions` по REST поверх сокета.
- Reconnect (`attemptReconnect`, стр. 491): `revalidateConnection` → `getConnection(For)` → re-mint WS URL → `connect`.

## DISCOVERY — порт / уже запущенный шлюз

- Per-home файлы в `~/.hermes`:
  - `gateway.sock` — unix control socket, 0600 (здесь живой);
  - `gateway.sock.path` — pointer (когда sun_path слишком длинный);
  - `gateway.pid` — JSON `{pid, kind, argv, start_time, hermes_home}`;
  - `gateway.lock` — flock + JSON-запись;
  - `gateway_state.json` — статус, `code_sha`, `served_profiles`.
- Host-wide singleton: lock-директория `$HERMES_GATEWAY_LOCK_DIR` иначе `$XDG_STATE_HOME/hermes/gateway-locks` (`gateway/status.py:321`); lock-файл с flock — `gateway/host_rendezvous.py:517 claim_host_lock` + `gateway/status.py _try_acquire_file_lock`; победитель публикует rendezvous record (`publish_record`, `HOST_PROTOCOL_VERSION=1`, identity через `/api/host/identity`).
- Desktop main находит шлюз **не по pid-файлу**, а командой: `runGatewayEnsure` (`electron/local-gateway.ts:15`) спавнит `hermes --profile <p> gateway ensure --json` и парсит однострочный JSON (`parseGatewayEnsureOutput`, стр. 140-157) → `payload.endpoint {api_origin, instance_id, profile_id, control_home, capabilities}`; `assertLocalGatewayEndpoint` (стр. 172-181) требует loopback-only origin. Ticket’ы mintятся через `gateway.sock`.
- READY по stdout для спавненных детей: `electron/backend-ready.ts:6` — regex `/^HERMES_(?:BACKEND|DASHBOARD)_READY port=(\d+)/m` (+ вариант для merged output); строка печатается в `hermes_cli/web_server.py:1291-1294`.
- **Отказ второго `hermes serve` / `gateway run`**: `gateway/run.py:4835 _claim_host_gateway_role` — проиграл host-flock → attach-решение (`host_attach.standalone_attach_decision`: REFUSE → `SystemExit(75)`), иначе `_refuse_second_host_gateway` (стр. 4962): печать «❌ Another gateway already owns this host: …» и **exit 75** (`GATEWAY_SERVICE_RESTART_EXIT_CODE = 75`, `gateway/restart.py:13`, EX_TEMPFAIL — супервизор ретраит и аттачится). `--force` пропускает. Плюс per-home `gateway.lock` flock для разграничения maintenance vs gateway (`gateway/runtime_ownership.py`).

## P0_METHODS — минимум hermesDesktop для первого экрана чата

1. `getConnection` / `getConnectionFor` — дескриптор бэкенда (ensure/spawn шлюза)
2. `getGatewayWsUrl` / `getGatewayWsUrlFor` — mint свежего WS URL (IPC `hermes:gateway:ws-url[-for]`)
3. `getBootProgress` + `onBootProgress` — экран «Starting Hermes…», retryable-флаги
4. `setActiveConnectionRoute` — публикация маршрута в main

Плюс renderer-side (не метод hermesDesktop): `gateway.connect(wsUrl)` по заминтованному URL. `revalidateConnection` — только reconnect, не первый boot; `windowControls` — chrome окна, не чат.

## FILES — что читалось

- `~/.hermes/hermes-agent/` — git metadata корня
- `apps/desktop/electron/main.ts` (7560-7608, 14181-14183, 14988-15015)
- `apps/desktop/electron/connection-config.ts` (91-105, 236-304)
- `apps/desktop/electron/local-gateway.ts` (1-60, 100-260, 290-360, 470-530, 590-683)
- `apps/desktop/electron/preload.ts` (28-187 + парсинг всего блока `exposeInMainWorld`)
- `apps/desktop/electron/backend-ready.ts` (1-12)
- `apps/desktop/src/app/gateway/hooks/use-gateway-boot.ts` (180-257, 300-340, 440-570, 748-769, 860-980, 1040-1170, 1525-1654)
- `apps/desktop/src/lib/gateway-ws-url.ts`, `apps/desktop/src/lib/browser-connection.ts` (100-220), `apps/desktop/src/lib/browser-transport.ts` (260-320), `apps/desktop/src/store/gateway.ts` (660-750), `apps/desktop/src/api/client.ts` (330-381)
- `apps/shared/src/websocket-url.ts` (полностью)
- `hermes_cli/gateway_runtime.py` (240-339), `gateway/run.py` (4835-4982), `gateway/host_rendezvous.py` (1-60, 517-537), `gateway/status.py` (321-330), `gateway/restart.py:13`, `gateway/runtime_ownership.py` (30-110), `hermes_cli/web_server.py` (1286-1294)
- Live state: `~/.hermes/gateway_state.json`, `gateway.pid`, `gateway.sock`, `ss -ltn` (порт 55057)
