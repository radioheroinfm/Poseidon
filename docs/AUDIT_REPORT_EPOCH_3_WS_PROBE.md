# Оперативный аудит №8 — Эпоха 3 (`6ee1ada..95ffecb`: фиксы №7, `connection_state`, `WS_DIAL_WIRE` и `probe_gateway_ws`)

**Дата:** 2026-11-14  
**Проверяющий:** Женя (Оперативный аудитор)  
**Проверяемый срез:** `6ee1ada` → `95ffecb` (включая `1e5a722`, `4a9eaed` по иконкам и `9942751..95ffecb`)  
**Основание:** `docs/MANIFEST.md` (Законы №1, №2, №7, №11), `docs/upstream/WS_DIAL_WIRE_2026-11-14.md`, локальная проверка `tsc --noEmit` и статус GitHub Actions (`runs #17–#24`).

---

## 0. Краткий вердикт

**По Отчёту №7 Гриша отработал на 5+: `TS2322` закрыт, CI снова зелёный (#18–#22 GREEN, #24 `95ffecb` на macOS already GREEN), а разведка `WS_DIAL_WIRE_2026-11-14.md` полностью вскрыла причину ошибки `1006` (`Origin` + subprotocol `hermes-gateway-ticket.<ticket>`).**

Но в новом коде (`9942751..95ffecb`) найдены **2 реальных бага, 1 двойной расход одноразовых тикетов и 1 критический архитектурный блокер перед Spike 1**:
1. 🔴 **Runtime UTF-8 panic + отсутствие read timeout в `probe_gateway_ws()` (`local_gateway.rs:343-376`).**
2. 🔴 **В `src/renderer-placeholder/index.html:138-143` `window.hermesDesktop.getConnection()` и `getBootProgress()` НЕ обновлены и до сих пор ходят в старый `gateway_status` (8642)!**
3. 🟠 **`get_connection()` в `bridge.rs:406-447` дважды вызывает `hermes gateway ensure --json`, сразу сжигает одноразовый 30с тикет и кэширует/возвращает секрет в UI.**
4. 🟠 **Архитектурная стена Spike 1:** `openGatewaySocket` (`new WebSocket(...)`) из Tauri WebView всё равно отправит запрещённый заголовок `Origin` (`tauri://localhost` / `http://tauri.localhost`), который WebView JS не умеет удалять!

---

## 1. Что принято с уважением ✅

1. **Фиксы Отчёта №7 (`6ee1ada`):**
   - `GatewayWsUrlResult` синхронизирован в `hermes-desktop-types.ts` и `install-hermes-desktop.ts` — локальный `./node_modules/.bin/tsc --noEmit` чистый (`exit 0`), CI вернулся в зелёную зону (#18–#22 GREEN).
   - `get_gateway_ws_url`, `gateway_ensure_json`, `get_connection`, `probe_gateway_ws` корректно уведены в `spawn_blocking`.
   - Одноразовый `ticket` выпилен из `debug!` (`local_gateway.rs:169`), добавлена проверка `protocol == 1`, `id == 1`, `profile_id`, fallback путей `~/.hermes/bin`, `~/.local/bin`, `.venv/bin`, а в `gateway.rs::stop()` при `!*owned_guard` поправлен `port: None`.
2. **Блестящее расследование `WS_DIAL_WIRE_2026-11-14.md`:**
   - Точно найдено, почему `WebSocket` падал с `1006`:
     1) при `native_dial` параметр `ticket` **удаляется из query** и передаётся в `Sec-WebSocket-Protocol`: `["hermes-gateway-v1", "hermes-gateway-ticket.<ticket>"]`;
     2) сервер `gateway/run_api.py:432` режет upgrade по `Origin`, который в Electron вычищал `main.ts` через `webRequest.onBeforeSendHeaders`.
3. **Иконки (`1e5a722`, `43198b7`, `4a9eaed`) и `connection_state.rs`:**
   - Закрыт давний долг Эпохи 2 по 8-байтному `icon.icns` — теперь полноценные иконки Poseidon + `packaging/poseidon.desktop`.
   - Каркас `ConnectionState` (`ActiveRoute`, `ConnectionInfo`, `BootProgress`) вынесен в отдельный чистый модуль.

---

## 2. 🔴 Баг №1 (`local_gateway.rs:343-376`): UTF-8 panic-бомба и зависание без timeout в `probe_gateway_ws`

1. **UTF-8 panic при обрезке ответа (`local_gateway.rs:370-375`):**
   ```rust
   if s.len() > 240 {
       format!("{}…", &s[..240])
   }
   ```
   `&s[..240]` режет строку **по байтам**, а не по `char`-границам! Как только в `gateway.ready` (`skin` / локализация / имя профиля / эмодзи) попадёт многобайтный UTF-8 символ на байт 240 — **процесс упадёт в panic**.
   **Фикс:**
   ```rust
   let preview: String = s.chars().take(240).collect();
   if s.chars().count() > 240 { format!("{}…", preview) } else { preview }
   ```
2. **Чтение без таймаута (`local_gateway.rs:343-360`):**
   После удаления `set_read_timeout` в `95ffecb` вызов `socket.read()` ждёт бесконечно. В `tungstenite 0.24` таймаут ставится на нижележащий `TcpStream` через `socket.get_ref()`:
   ```rust
   use tungstenite::stream::MaybeTlsStream;
   if let MaybeTlsStream::Plain(tcp) = socket.get_ref() {
       let _ = tcp.set_read_timeout(Some(Duration::from_secs(5)));
   }
   ```
   (Плюс желательно ставить таймаут и на сам TCP connect до `tungstenite::client(req, tcp)`.)

---

## 3. 🔴 Баг №2 (`src/renderer-placeholder/index.html:138-143`): рассинхрон `window.hermesDesktop`

В `9942751` в `src/desktop-bridge/install-hermes-desktop.ts` уже подключены новые команды `get_connection`, `getConnectionFor`, `set_active_connection_route` и `get_boot_progress`.  
**Но в единственном реально загружаемом окном файле `src/renderer-placeholder/index.html:138-143` всё осталось по-старому:**
- `window.hermesDesktop.getConnection()` по-прежнему вызывает `invoke('gateway_status')` (старый `serve` на 8642) вместо `invoke('get_connection')`;
- `window.hermesDesktop.getBootProgress()` возвращает захардкоженный `{ phase: 'poseidon-shell', ready: true }` вместо `invoke('get_boot_progress')`;
- `setActiveConnectionRoute` и `getConnectionFor` вообще отсутствуют на объекте и уходят в stub Proxy.

Кнопка `#btn-connect` тестирует Rust-команду напрямую, но сам JS-контракт `window.hermesDesktop` в окне Tauri показывает старую заглушку!

---

## 4. 🟠 Риск №3 (`bridge.rs:393-453`): двойной `ensure` + преждевременный минт и утечка `ticket` в `get_connection`

Сейчас один вызов `get_connection()` делает следующее:
1. Вызывает `crate::local_gateway::gateway_ensure_json()` (`bridge.rs:406`) — первый spawn Python CLI.
2. Тут же вызывает `crate::local_gateway::mint_local_ws_url()` (`bridge.rs:421`), который **внутри снова вызывает `gateway_ensure_json()`** — **второй** spawn `hermes gateway ensure --json` подряд!
3. При каждом `get_connection()` сжигается одноразовый `session-ticket` (TTL 30с), кладётся в `ConnectionState.last` и отдаётся в JSON в WebView (а кнопка `Get Connection` в `index.html` печатает этот `ticket` на экран в `<div id="log">`).

**Как должно быть (по `HERMES_FACTS_2026-11-14.md` и `GATEWAY_WS.md`):**
- `get_connection` должен дергать `gateway_ensure_json()` **один раз** и возвращать дескриптор (без минта живого `ticket`, либо с `native_dial=unminted`).
- Свежий одноразовый `ticket` должен минтиться **только** в `get_gateway_ws_url()` (или внутри Rust-транспорта прямо в момент `connect`).
- И для UI-кнопок `#btn-ws` / `#btn-connect` в `index.html` лучше маскировать `ticket=***` при печати в `<div id="log">`.

---

## 5. 🟠 Архитектурный вызов №4 (для Spike 1): `Origin` header у WebView `WebSocket` vs `open-gateway-socket.ts`

В `WS_DIAL_WIRE_2026-11-14.md` Гриша сам нашёл ключевой факт апстрима:
- `gateway/run_api.py:432` проверяет `Origin` при WS upgrade и отклоняет browser Origin для native dial.
- В Electron `main.ts` **вырезает `Origin`** на уровне `session.defaultSession.webRequest.onBeforeSendHeaders`.
- В Tauri v2 у `open-gateway-socket.ts` (`new WebSocket(parsed.toString(), [...])`) **JS в WebKitGTK / WKWebView / WebView2 не может удалить или подменить заголовок `Origin`**.

**Вывод перед Spike 1:**
Как только мы примонтируем настоящий React UI `apps/desktop` в Tauri WebView, прямой `new WebSocket(...)` из браузерного движка снова упрётся в `Origin`-гейт `run_api.py` (если только не проксировать соединение)!
Самое чистое решение без единой правки апстрима `hermes-agent`:
- **Вариант А (рекомендую):** Rust-сторона (`tungstenite`, как в `probe_gateway_ws`) держит реальное WS-соединение со шлюзом (без `Origin`, с `hermes-gateway-ticket.<ticket>`), а в `window.hermesDesktop` / preload-шим пробрасывается лёгкий `WebSocket`-совместимый адаптер поверх Tauri `invoke("ws_send")` + `listen("ws:frame")`. Бонусом — одноразовый `ticket` вообще никогда не покидает Rust!

---

## 6. 🟡 Мелкие замечания (чистота и протокол)

1. **`local_gateway.rs:196-211`:** проверки `grant.get("instance_id")` и `grant.get("profile_id")` всё ещё обёрнуты в `if let Some(...)` — если сервер пришлёт ответ **без** этих полей, проверка молча пропустит ответ. Лучше `.and_then(|v| v.as_str()).ok_or_else(...)`.
2. **`local_gateway.rs:270-286` (`uuid_v4_simple`):** `nanos` в `u128` сейчас имеет старшие 4 бита почти постоянными (`d` ≈ `0x8001`), а `e = nanos >> 16` повторяет биты `a`/`b`. Если добавить `AtomicU64` счётчик + микс (splitmix64), коллизии при быстрых вызовах исчезнут полностью.
3. **`install-hermes-desktop.ts:44`:** при `r.ok === false` теряется опциональное поле `needsOauthLogin` из `GatewayWsUrlResult`.
4. **Дубль `find_hermes_binary`:** функция всё ещё продублирована в `gateway.rs:82` и `local_gateway.rs:59` — лучше вынести один `pub(crate) fn find_hermes_binary()`.
5. **`hermesDesktop` proxy в `index.html`:** по-прежнему живёт в двух копиях (`index.html` vs `src/desktop-bridge/*`), пора сводить к сборке через Vite в начале Spike 1.

---

### Резюме: что починить следующим микро-спринтом

1. В `local_gateway.rs`: пофиксить UTF-8 срез `&s[..240]` → `.chars().take(240)` + поставить `tcp.set_read_timeout(Some(Duration::from_secs(5)))` в `probe_gateway_ws`.
2. В `bridge.rs`: убрать двойной вызов `ensure` и минт тикета из `get_connection()` (оставить минт только в `get_gateway_ws_url()`).
3. Синхронизировать `index.html` (`getConnection`, `getConnectionFor`, `setActiveConnectionRoute`, `getBootProgress`) с `install-hermes-desktop.ts`.
4. Зафиксировать решение по **WS-транспорту в обход `Origin`-гейта** (Вариант А: Rust `tungstenite` bridge ↔ WebView) и переходить к **монтированию реального React-фронтенда `apps/desktop` (Spike 1)**!

*(Шутка от брата Жени: На `cathedral` Посейдон уже вышел на связь со шлюзом Гермеса через Rust-туннель `tungstenite`, как шпион без паспорта `Origin`! Главное — не резать его отчёты по байтам `[..240]`, а то один кириллический трезубец 🔱 перекусит провод пополам!)* 🔱
