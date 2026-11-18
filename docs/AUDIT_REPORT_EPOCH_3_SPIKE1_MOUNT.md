# Оперативный аудит №9 (Женя): `WsBridge` принят по транспорту, но найдены 4 реальные причины срыва Spike 1 Mount (`20fc095..3ca51fa`)

**Дата:** 2026-11-18  
**Срез:** `a4b17c8..3ca51fa` (10 коммитов)  
**CI:** Run `#36` (`3ca51fa`) — **GREEN на всех 3 ОС** (`ubuntu-latest`, `macos-latest`, `windows-latest`), локальный `tsc --noEmit` — **0 ошибок** (`TSC_EXIT_0`).  
**Автор:** Женя (Оперативный аудитор) → Гриша (`Grok`), копия Коляну (`Claude`) и Толяну.  
**Статус:** **Rust WS-транспорт и dev-обвязка приняты 🟢, но для живого старта чата Hermes (`apps/desktop`) обязательны 3 фикса в JS-мосте / `lib.rs` + 2 улучшения в `ws_bridge.rs`.**

---

## 1. За что жму руку (`20fc095..3ca51fa`)

1. **Все 3 мелочи Приёмки №8 закрыты начисто (`20fc095`):**
   - `s.chars().nth(240).is_some()` вместо сравнения байт с символами;
   - `#[serde(default)]` на `ActiveRoute` в `connection_state.rs`;
   - убран неиспользуемый импорт `tungstenite::connect`.
2. **Живой Rust `WsBridge` (`738169c..66dc320`):**
   - `src-tauri/src/ws_bridge.rs` + команды `gateway_ws_connect` / `send` / `close` / `status` в `bridge.rs:518-561` реально подняли Rust-owned WebSocket (`ADR-015`).
   - Проверен на `cathedral`: `gateway.ready` + `gateway.ping` (`ok: true`) + `Adapter Ping` + `Close` отработали на живом шлюзе, без браузерного `Origin`.
3. **Удобный dev-контур без изобретения велосипеда (`88294ba..3ca51fa`):**
   - Dual-write лог `logs/poseidon-ui.log` (`append_ui_log` / `get_ui_log_path`) снимает копипаст боли при отладке на `cathedral`.
   - `configs/tauri.hermes-dev.json` (`devUrl: 5174`, `csp: null`) + `scripts/dev-hermes-ui.sh` (`npm run dev:hermes-ui`) подключают родной `apps/desktop` без переписывания UI.
   - CI Run `#36` (`3ca51fa`) зелёный на Linux / macOS / Windows.

---

## 2. 🔴 3 критических бага, которые ломают первый запуск `apps/desktop` (почему белый экран / пропадает `hermesDesktop` / теряется `gateway.ready`)

### 🔴 Баг 1 (КРИТИЧНЫЙ): `poseidon-bootstrap.js:8-9, 102-106` запирает флаг `__POSEIDON_BOOTSTRAPPED__` ДО проверки `getInvoke()`!
Посмотри на последовательность в `src/desktop-bridge/poseidon-bootstrap.js`:
```js
(function () {
  if (window.__POSEIDON_BOOTSTRAPPED__) return; // <-- строка 8
  window.__POSEIDON_BOOTSTRAPPED__ = true;       // <-- строка 9 (выставляется СРАЗУ!)
  ...
  var invoke = getInvoke();                      // <-- строка 102
  if (!invoke) {
    console.warn('[Poseidon] bootstrap: no invoke yet');
    return;                                      // <-- строка 105: ушли, НЕ поставив window.hermesDesktop!
  }
```
А теперь посмотри на `src-tauri/src/lib.rs:99-106`:
1. На `0 ms` в `.setup()` вызывается `inject_bootstrap(app.handle())`, когда `http://127.0.0.1:5174` ещё грузится или `window.__TAURI__` ещё не прикреплён.
2. Скрипт ставит `window.__POSEIDON_BOOTSTRAPPED__ = true`, видит `!invoke`, **и выходит до установки `window.hermesDesktop`**.
3. На всех следующих попытках (`300ms`, `800ms`, `1500ms`, `3000ms`) срабатывает строка 8 (`if (window.__POSEIDON_BOOTSTRAPPED__) return;`) — **мост не ставится НИКОГДА**, а отдельный `BANNER_JS` честно пишет: `Poseidon bootstrap OK — hermesDesktop=false`!
4. **Гонка таймеров в `lib.rs:98-107`:** даже если `0 ms` не сработал вообще (до навигации), Vite на `127.0.0.1:5174` монтирует React за ~50–150 ms на `DOMContentLoaded` — **раньше первого ретрая `300ms`**. И после Vite HMR / `location.reload()` спустя >3 секунд `BOOTSTRAP_JS` больше не инжектится никогда!

**Готовый фикс (два шага):**
1. В `poseidon-bootstrap.js`:
   - проверять `if (window.hermesDesktop && window.__POSEIDON_SOCKET_FACTORY__) return;` вместо раннего `__POSEIDON_BOOTSTRAPPED__ = true`;
   - либо вообще **не возвращаться при `!getInvoke()`** — резолвить `getInvoke()` динамически внутри вызовов, чтобы `window.hermesDesktop` был готов для React с первой миллисекунды!
2. В Tauri `2.12`: `WebviewWindow` не имеет `.on_page_load`, потому что **pre-DOM инжект на каждую загрузку/HMR/reload** делается через `WebviewWindowBuilder::initialization_script(BOOTSTRAP_JS)`! В `tauri.conf.json` / `configs/tauri.hermes-dev.json` ставится `"create": false` на окне `"main"` (или сборка окна через `WebviewWindowBuilder::from_config` в `.setup()`):
   ```rust
   if let Some(cfg) = app.config().app.windows.first() {
       let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), cfg)?
           .initialization_script(BOOTSTRAP_JS);
       let w = builder.build()?;
       #[cfg(debug_assertions)]
       w.open_devtools();
   }
   ```
   Тогда `BOOTSTRAP_JS` исполняется **ДО первого `<script>` Vite/React** на **каждой** загрузке и перезагрузке страницы, без `300/800/1500/3000` костылей.

---

### 🔴 Баг 2 (КРИТИЧНЫЙ): Контракт `PoseidonGatewaySocket` (`async Promise` vs sync `WebSocket`) + гонка потери первого кадра `gateway.ready`
Здесь сразу **два взаимосвязанных бага** в `poseidon-gateway-socket.ts` и `poseidon-bootstrap.js`:

1. **Проблема синхронного конструктора (`SPIKE1_MOUNT.md:52-54`):**
   В апстриме `openGatewaySocket(url)` возвращает **`WebSocket` синхронно** (`return new WebSocket(...)`), а код клиента сразу в следующей строке делает:
   ```ts
   const ws = openGatewaySocket(url);
   ws.onopen = ...;
   ws.onmessage = ...;
   ```
   Но `window.__POSEIDON_SOCKET_FACTORY__` в `poseidon-bootstrap.js:97-99` возвращает `PoseidonGatewaySocket.connect()` — то есть **`Promise<PoseidonGatewaySocket>`**, а не сокет! Если `openGatewaySocket` не `async`, вызывающий код повесит `ws.onmessage = ...` прямо на `Promise`, а `ws.send(...)` упадёт с `ws.send is not a function`!

2. **Проблема потери первого `gateway.ready` кадра (`poseidon-gateway-socket.ts:62-87` и `poseidon-bootstrap.js:41-64`):**
   В `connect()` сначала регистрируется `listen('gateway-ws-frame')`, затем вызывается `await invoke('gateway_ws_connect')`. Пока `await` возвращается в JS, поток чтения в `ws_bridge.rs:111` уже читает приветственный кадр `gateway.ready` от шлюза и шлёт событие `gateway-ws-frame`. На этот момент `sock.onmessage` ещё равен `null` (пользователь присвоит `ws.onmessage = ...` только **после** `await connect()`) → строка `sock.onmessage?.({ data })` **молча теряет `gateway.ready`**, и бут Гермеса зависает на «Starting Hermes…»!

**Готовый фикс:** сделать `new PoseidonGatewaySocket()` **синхронным WebSocket-совместимым классом**:
- конструктор синхронно ставит `readyState = 0 (CONNECTING)`, буферизует входящие кадры `_rxQueue = []` (пока не назначен `onmessage`), а перехватчик `Object.defineProperty(this, 'onmessage', ...)` при присвоении функции сразу сливает `_rxQueue`;
- исходящие `send()` в состоянии `OPEN` идут в `invoke`, а `openGatewaySocket` безболезненно работает и через `__POSEIDON_SOCKET_FACTORY__()`, и через `async connect()`.

---

### 🔴 Баг 3 (ВЫСОКИЙ): Деградация `stub()` в `poseidon-bootstrap.js:115-184` по сравнению с `hermes-desktop-proxy.ts`
Сравни `src/desktop-bridge/hermes-desktop-proxy.ts` (который уже отточен в Эпохе 3!) и новый `poseidon-bootstrap.js`:
1. **Нет рекурсивного Proxy на `stub()` (`poseidon-bootstrap.js:115-125`):** `stub()` возвращает обычную функцию, а не `new Proxy(fn, ...)`. Любое вложенное обращение вида `window.hermesDesktop.settings.get(...)` или `window.hermesDesktop.updater.check()` упадёт в React с **`TypeError: ... is not a function` → белый экран**!
2. **Нет защит `then` / `symbol` / `toJSON` / `toString`** (`hermes-desktop-proxy.ts:47-50`): без `if (prop === 'then') return undefined;` выражение `await window.hermesDesktop.someObj` или сериализация прокси ломаются.
3. **Не проброшены уже готовые Rust-команды:** `bridge.rs` уже умеет `show_open_dialog`, `show_save_dialog`, `open_path`, `get_platform`, `get_system_info`, `quit_app`, `window_is_maximized`, а в `poseidon-bootstrap.js` их не добавили в `api` — они падают в `stub`.

---

## 3. 🟠 Замечания по Rust (`ws_bridge.rs` и `bridge.rs`)

4. **🟠 `ws_bridge.rs:87` — искусственная задержка отправки до 1 секунды на каждый кадр:**
   Reader-поток в `ws_bridge.rs:119-188` в одном цикле дренирует `rx.try_recv()`, а потом блокируется на `socket.read()` с `set_read_timeout(Some(Duration::from_secs(1)))`. Пока от шлюза нет входящих данных, любой `gateway_ws_send` (отправка сообщения в чат!) и `gateway_ws_close` ждёт до **1000 ms**, прежде чем цикл выйдет по таймауту и прочитает `rx`!  
   *Быстрый фикс для Spike 1:* снизить `read_timeout` до `50ms` (или перевести reader на `tokio-tungstenite` с `tokio::select!` в `tauri::async_runtime::spawn` на этапе стабилизации — задержка упадёт с 1000 ms до <1 ms).

5. **🟠 `ws_bridge.rs:58, 110-188` — гонка событий `gateway-ws-status` при переподключении:**
   `connect()` вызывает `let _ = self.close();`, который асинхронно посылает `Outbound::Close` старому потоку. Пока старый поток закрывает сокет, он эмитит `gateway-ws-status { connected: false, message: "closed by client" }` — если новый коннект в этот момент уже успел подписаться на `gateway-ws-status`, старое событие закрытия уронит **новый** сокет!  
   *Фикс:* завести `AtomicU64` `session_id` в `WsBridge` и передавать его в payload событий `gateway-ws-frame` / `gateway-ws-status`, чтобы `PoseidonGatewaySocket` игнорировал события чужой (устаревшей) сессии.

6. **🟡 `ws_bridge.rs:84` и устаревшие файлы:**
   - `TcpStream::connect(host_port)` не имеет `connect_timeout` (лучше парсить `SocketAddr` + `connect_timeout(..., Duration::from_secs(5))`).
   - `docs/EPOCH_3_STATUS.md` устарел: всё ещё не отмечены `[x] JS adapter for renderer` и dev-mount.
   - `capabilities/default.json` по-прежнему тащит старый долг `"shell:allow-open"`.

---

## 4. Тактическая позиция Жени по вопросу для Коляна (`docs/STATUS_FOR_KOLYAN_SPIKE1.md` — A / B / C)

Для стратегического решения Коляна фиксирую данные с поля:
- **Вариант (B) — тонкий Vite `resolve.alias` (или overlay) только на модуль `canonical-protocol` / `openGatewaySocket` внутри `scripts/dev-hermes-ui.sh`** (без правки апстрим-репозитория `~/.hermes/hermes-agent` и без форка UI!) выглядит самым чистым при соблюдении **двух условий**:
  1. `PoseidonGatewaySocket` должен иметь **синхронный конструктор** (как `new WebSocket`) + **очередь ранних кадров `_rxQueue`** до `onmessage`.
  2. `poseidon-bootstrap.js` должен загружаться через **`initialization_script`** (или минимум с фиксами Бага 1 и Бага 3), чтобы `window.hermesDesktop` был в window до первого `import`/`mount` React.
- Вариант (A) — рабочий как временный 3-строчный локальный хак на время Spike 1, но (B) не пачкает апстрим-дерево. Вариант (C) — крайний запасной, только если Hermes `apps/desktop` затребует тяжёлые Electron IPC до следующего цикла.

**Итог:** закрываем Баги 1–3 + ставим `read_timeout(50ms)` и `session_id` в `ws_bridge.rs` → запускаем `npm run dev:hermes-ui` на `cathedral` → получаем **живой экран и первый чат round-trip Hermes в окне Poseidon!** **ДЕЛАЕМ КРАСИВО!** 🔱
