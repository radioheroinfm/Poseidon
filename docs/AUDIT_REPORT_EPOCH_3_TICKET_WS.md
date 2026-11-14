# Оперативный аудит №7 — Эпоха 3 (`841a039..ba8ed8e`: Фиксы стабов, `hermes gateway ensure --json` и `session-ticket`)

**Дата:** 2026-11-14  
**Проверяющий:** Женя (Оперативный аудитор)  
**Проверяемый срез:** `841a039` → `ba8ed8e` (14 файлов, +706/-67 от `7eaf5fd`)  
**Основание:** `docs/MANIFEST.md` (Законы №1, №2, №7, №11), `docs/upstream/HERMES_FACTS_2026-11-14.md`, `docs/upstream/ENSURE_AND_TICKET_2026-11-14.md`, локальная проверка `tsc --noEmit` и логи GitHub Actions (`runs #10–#13`).

---

## 0. Краткий вердикт

**По апстриму сделан огромный прорыв, замечания Отчёта №6 закрыты, НО на `ba8ed8e` красный CI на всех трёх ОС (`runs #11, #12, #13` FAILED на шаге `Typecheck frontend`).**

Гриша провёл блестящую разведку живого `hermes-agent` (`v0.23.0`, SHA `2bd378ed`), снял реальный `hermes gateway ensure --json`, раскопал протокол `session-ticket` на `~/.hermes/gateway.sock` и написал `src-tauri/src/local_gateway.rs` (причём сразу грамотно прикрыл модуль `#[cfg(unix)]` в `lib.rs`, не сломав Windows-компиляцию Rust).

Но при этом:
1. В `2ebcf31` обновилась реализация `getGatewayWsUrl()` в `install-hermes-desktop.ts`, а интерфейс в `hermes-desktop-types.ts` остался старым (`Promise<string | null>`) — **`npx tsc --noEmit` падает с ошибкой `TS2322`**, из-за чего CI три коммита подряд падает ещё до `cargo test` и `tauri build`.
2. Два новых async-метода в `bridge.rs` (`get_gateway_ws_url`, `gateway_ensure_json`) выполняют синхронный subprocess/socket I/O прямо на потоках Tokio без `spawn_blocking`.
3. В `local_gateway.rs` есть утечка одноразового `ticket` в `debug!`-лог, расхождение с `GatewayManager::find_hermes_binary()` и неполная валидация ответа `session-ticket`.

---

## 1. Что принято и сделано красиво ✅

1. **Закрыты ловушки из P.S. Отчёта №6 (`841a039`):**
   - `on*` подписки (`/^[on][A-Z]/` → точнее `/^on[A-Z]/`) в `hermes-desktop-proxy.ts` и `index.html` теперь синхронно возвращают `() => void`, а не `Promise<null>`.
   - Булевы capability-флаги (`glassSupported`, `translucencySupported`, `localModelsEnabled`, `assumeFreshInstall`) явно возвращают `false`.
   - `stderr` дочернего процесса шлюза теперь дренируется в отдельном потоке с `warn!("[hermes serve:stderr] {}", line)`.
   - `GatewayManager::stop()` в owned-ветке возвращает `port: None`, если порт закрыт.
2. **Опора на факты вместо гипотез (`HERMES_FACTS_2026-11-14.md` + `ENSURE_AND_TICKET_2026-11-14.md`):**
   - Задокументированы живые структуры `ensure --json`, `gateway_state.json`, протокол `gateway.sock` (`protocol: 1, id: 1, verb: "session-ticket"`), TTL 30s и URL `/api/ws?native_dial=<uuid>&ticket=<ticket>`.
3. **Кроссплатформенная аккуратность в `lib.rs`:**
   - `#[cfg(unix)] mod local_gateway;` и `#[cfg(not(unix))]` заглушки в `bridge.rs` не дают сломать сборку на `windows-latest` из-за `std::os::unix::net::UnixStream`.

---

## 2. 🔴 Блокер №1 (CI RED на 3 ОС): сломан `tsc --noEmit` (`TS2322`)

**Факт проверки:**
- Локальный запуск `./node_modules/.bin/tsc --noEmit` на срезе `ba8ed8e` завершается с **exit code 2**:
  ```
  src/desktop-bridge/install-hermes-desktop.ts(34,5): error TS2322:
    Type '() => Promise<{ ok?: boolean; wsUrl?: string; error?: string; }>'
    is not assignable to type '(profile?: string | undefined) => Promise<string | null>'.
  ```
- GitHub Actions runs **#11 (`2ebcf31`)**, **#12 (`3ff9584`)**, **#13 (`ba8ed8e`)** упали на `ubuntu-latest`, `macos-latest` и `windows-latest` на шаге `Typecheck frontend` (`Cargo test` и `Build Tauri` были skipped).

**Причина:** в `src/desktop-bridge/install-hermes-desktop.ts:34` `getGatewayWsUrl` уже возвращает объект `{ ok, wsUrl, error }`, а в `src/desktop-bridge/hermes-desktop-types.ts:33` осталась старая сигнатура `getGatewayWsUrl: (profile?: string) => Promise<string | null>;`. Плюс в касте `as { ok?: boolean; ... }` потерян discriminated union из `GATEWAY_WS.md` (`needsOauthLogin?: true`).

**Готовый патч (`src/desktop-bridge/hermes-desktop-types.ts` и `install-hermes-desktop.ts`):**
```ts
// hermes-desktop-types.ts
export type GatewayWsUrlResult =
  | { ok: true; wsUrl: string }
  | { ok: false; error: string; needsOauthLogin?: true };

export interface HermesDesktopP0 {
  // ...
  getGatewayWsUrl: (profile?: string) => Promise<GatewayWsUrlResult>;
  // ...
}
```
```ts
// install-hermes-desktop.ts
getGatewayWsUrl: async (): Promise<GatewayWsUrlResult> => {
  const r = await invoke('get_gateway_ws_url');
  if (r && typeof r === 'object' && 'ok' in r && typeof (r as { ok?: unknown }).ok === 'boolean') {
    return r as GatewayWsUrlResult;
  }
  if (typeof r === 'string' && r.length > 0) return { ok: true, wsUrl: r };
  return { ok: false, error: 'no url' };
},
```

---

## 3. 🔴 Риск №2 (`bridge.rs:226-265`): блокировка async executor Tauri

**Где:** `src-tauri/src/bridge.rs` — команды `get_gateway_ws_url` и `gateway_ensure_json`.

В отличие от `gateway_start` и `gateway_ensure`, которые честно уведены в `tauri::async_runtime::spawn_blocking`, новые `pub async fn get_gateway_ws_url` и `pub async fn gateway_ensure_json` вызывают **синхронный** `crate::local_gateway::mint_local_ws_url()` / `gateway_ensure_json()` прямо внутри `async fn`:
- `Command::new(&bin).args(["gateway", "ensure", "--json"]).output()` — при холодном старте шлюза может висеть **десятки секунд**;
- `UnixStream::connect(&sock)` + `read_line()` с таймаутом 5с — блокирующий сокетный I/O.

**Последствие:** зависание worker-потока Tokio/Tauri и деградация отзывчивости всех остальных `invoke`-команд (окно, статус, диалоги).

**Фикс:** обернуть оба вызова в `tauri::async_runtime::spawn_blocking(...)`:
```rust
#[tauri::command]
pub async fn get_gateway_ws_url(
    _state: State<'_, Arc<GatewayManager>>,
) -> Result<GatewayWsUrlResult, String> {
    #[cfg(unix)]
    {
        tauri::async_runtime::spawn_blocking(|| {
            match crate::local_gateway::mint_local_ws_url() {
                Ok(ws_url) => GatewayWsUrlResult {
                    ok: true,
                    ws_url: Some(ws_url),
                    error: None,
                },
                Err(e) => {
                    log::warn!("mint_local_ws_url: {}", e);
                    GatewayWsUrlResult {
                        ok: false,
                        ws_url: None,
                        error: Some(e),
                    }
                }
            }
        })
        .await
        .map_err(|e| e.to_string())
    }
    // ...
}
```
Аналогично `gateway_ensure_json` → `spawn_blocking`.

---

## 4. 🟠 Риск №3 (`local_gateway.rs:146`): утечка одноразового `ticket` в лог

**Где:** `src-tauri/src/local_gateway.rs:146`:
```rust
debug!("ticket reply: {}", line.trim());
```
`line` содержит полный JSON ответа сокета, включая секретный `result.ticket` (`secrets.token_urlsafe(32)`). При включённом `RUST_LOG=debug` (что в Tauri при отладке Spike 1 включают постоянно, или при отправке логов пользователем) одноразовый действующий токен доступа к сессиям шлюза попадает в терминал/лог-файл в открытом виде.

**Фикс:** логировать только метаданные без секрета:
```rust
debug!(
    "ticket reply ok={:?} instance={:?} ttl={:?}",
    reply.get("ok"),
    reply.get("result").and_then(|g| g.get("instance_id")),
    reply.get("result").and_then(|g| g.get("expires_in_seconds")),
);
```
(И на JS-стороне при добавлении логирования WS URL тоже маскировать `?ticket=...` перед выводом в UI `#log`.)

---

## 5. 🟠 Риск №4: раздвоенный `find_hermes_bin()` и два несвязанных `ensure`

1. **GUI-приложение не найдёт `hermes` (`local_gateway.rs:56-58`):**
   `local_gateway::find_hermes_bin()` делает **только** `which::which("hermes")`. А в `GatewayManager::find_hermes_binary()` (`gateway.rs:82-98`) уже добавлен fallback на `~/.hermes/bin/hermes`, `~/.local/bin/hermes`, `~/hermes-agent/.venv/bin/hermes`.
   В Linux/macOS при запуске Tauri из GUI (не из интерактивного shell) `~/.local/bin` и `.venv/bin` обычно отсутствуют в `PATH` → `Ensure JSON` и `get_gateway_ws_url` упадут с `ENOENT`, хотя `GatewayManager` в том же приложении бинарник находит!  
   **Фикс:** вынести единую `pub(crate) fn find_hermes_binary()` (например, в `gateway.rs` или общий `hermes_env.rs`) и переиспользовать её в обоих модулях.

2. **Раздвой архитектуры запуска в `index.html` и `bridge.rs`:**
   - Кнопка `Ensure Gateway` вызывает `gateway_ensure` → `GatewayManager::start()` → запускает **`hermes serve`** на порту `8642/9119` с `owned_by_us`.
   - Кнопка `Ensure JSON` / `WS URL` вызывает `hermes gateway ensure --json` → общается с **`gateway run`** (порт `55057` на `cathedral`).
   - При этом `hermesDesktop.getConnection()` и в `index.html`, и в `install-hermes-desktop.ts` всё ещё дёргает `gateway_status` (от `serve`!) и лепит гипотезу `ws://127.0.0.1:${st.port}` вместо `ensure --json`.
   До Spike 1 стоит свести их в единую картину: `getConnection()` должен опираться на `gateway_ensure_json` (а если `hermes gateway ensure` сам поднимает внешний демон/supervisor — честно решить, когда Poseidon считает процесс `owned_by_us`, чтобы закрытие окна не оставляло сирот и не убивало чужой `systemd`-демон).

---

## 6. 🟡 Средние замечания (протокол, устойчивость и чистота)

1. **Неполная валидация `session-ticket` ответа (`local_gateway.rs:151-177`):**
   В `docs/upstream/ENSURE_AND_TICKET_2026-11-14.md` прямо зафиксировано правило из `local-gateway.ts:676`: клиент валидирует:
   - `reply.ok === true` (есть ✓)
   - `reply.protocol === 1` (**нет ✗**)
   - `reply.id === 1` (**нет ✗**)
   - `grant.instance_id === endpoint.instance_id` (у нас проверяется только `if let Some`, т.е. отсутствие поля пройдёт молча!)
   - `grant.profile_id === home` (**нет ✗** — `profile_id` передаётся аргументом в `mint_session_ticket`, но не сверяется с `grant.profile_id`).
   **Фикс:** проверять строго все 5 полей, включая обязательное наличие `instance_id` и `profile_id`.

2. **Мелочи в `local_gateway.rs`:**
   - `uuid_v4_simple()` (`227-234`) отдаёт 32 hex-символа от `SystemTime::now()` без дефисов и RFC 4122 версии (`8-4-4-4-12`). Лучше форматировать в `8-4-4-4-12` (или подключить лёгкий `uuid = { version = "1", features = ["v4"] }` позже).
   - `url_encode()` (`218-225`) делает `c as u8` по `chars()`, что порежет multi-byte UTF-8 символ если такой когда-нибудь попадёт на вход — правильнее итерировать `s.as_bytes()`.
   - `hermes_home()` (`47-54`): пустой `HERMES_HOME=""` даст `PathBuf::from("")`; безопаснее `.ok().filter(|s| !s.trim().is_empty())`.
   - `gateway_ensure_json()` (`82-85`) берёт первую строку на `{` — если CLI когда-нибудь выведет multi-line pretty JSON, `serde_json::from_str(line)` сломается. Можно сначала попробовать `serde_json::from_str::<EnsurePayload>(stdout.trim())`, а уже как fallback — построчный поиск JSON-строки с конца (`.lines().rev()`).

3. **`gateway.rs:344-354` — хвост в `stop()` при `!owned_guard`:**
   В owned-ветке в конце `stop()` ты уже исправил `port: if port_open { Some(port_now) } else { None }`, а в раннем `return` при `!*owned_guard` до сих пор остаётся `port: Some(port_now)` даже если `port_open == false`.

4. **Дублирование `window.hermesDesktop` (`index.html` vs `src/desktop-bridge/`):**
   Правки из Отчёта №6 пришлось вносить дважды — и в `hermes-desktop-proxy.ts` + `install-hermes-desktop.ts`, и в `<script>` в `src/renderer-placeholder/index.html`. Они уже слегка расходятся: в `index.html` у Proxy нет `toJSON`/`toString`, а в `install-hermes-desktop.ts` нет `__TAURI_INTERNALS__` fallback. Как только появится Vite/bundler для frontend в Spike 1 — `<script>` в HTML надо вырезать и оставить один источник правды.

---

## 7. Что сделать прямо сейчас (чтобы вернуть 3×GREEN CI и двинуться к Spike 1)

1. Синхронизировать `GatewayWsUrlResult` в `src/desktop-bridge/hermes-desktop-types.ts` и `install-hermes-desktop.ts` (и прогнать `npx tsc --noEmit` локально!).
2. Обернуть `get_gateway_ws_url` и `gateway_ensure_json` в `spawn_blocking` в `bridge.rs`.
3. Выпилить `ticket` из `debug!` в `local_gateway.rs:146`, переиспользовать `find_hermes_binary()` из `gateway.rs`, добить проверку `protocol / id / profile_id` в `mint_session_ticket`.
4. Проверить живой `Probe WS` на `cathedral` — с minted `?native_dial=...&ticket=...` WS должен пройти auth-рукопожатие на `55057`!

*(Шутка от брата Жени в духе Манифеста: Посейдон уже договорился с подземельем Гермеса о пропуске по сокету, получил одноразовый билет `session-ticket` на 30 секунд… но на входе в TypeScript-портал забыл сменить старый паспорт `Promise<string | null>` — и вахтёр `tsc` положил все три платформы на лопатки. Чиним ксиву в `hermes-desktop-types.ts` — и погнали дальше!)* 🔱
