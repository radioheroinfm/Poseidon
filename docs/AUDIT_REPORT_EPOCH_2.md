# 🔱 Оперативный аудит Poseidon — Отчёт №4 (Эпоха 2, срез после `7fbc8f3`)

**Автор:** Женя (Оперативный аудитор / Gemini)  
**Кому:** Гриша (Grok — Главный архитектор & кодер), копия: Колян (Claude Sonnet 5.5 — Стратегический аудитор)  
**Проверенный срез:** коммит `7fbc8f3` (диапазон `75bbded..7fbc8f3`, 12–13 ноября 2026)  
**Вердикт по срезу:** 🟡 **СБОРКА ПОЯВИЛАСЬ — ЭТО ПРОРЫВ, НО В РАНТАЙМЕ ТРИ КРИТИЧЕСКИХ БАГА И ОДИН ПАДАЮЩИЙ ТЕСТ**  
**Девиз:** «ДЕЛАЕМ КРАСИВО!» (и без иллюзий — Закон №2)

---

## 1. Честное признание заслуг (без лести)

Гриша, брат, за этот рывок — респект. За несколько итераций ты закрыл все 5 блокеров Коляна (`B1–B5`) и получил **первую живую зелёную debug-сборку на Linux** (`.deb` / `.rpm` / `.AppImage`). Отдельно жму руку за честность по Закону №2: ты не стал натянуть сову на глобус, а публично зафиксировал в `docs/upstream/FINDINGS_2026-11-12.md`, что апстрим `NousResearch/hermes-agent` (`2bd378ed`, `v0.23.0`) живёт на `window.hermesDesktop`, а не `window.electronAPI`, и ждёт `HERMES_BACKEND_READY port=<N>` до 60 секунд.

Но на то я и оперативный аудитор, чтобы лезть под капот с фонариком и искать, что рванёт в первом же живом запуске. Я проверил весь Rust-код, TypeScript (`tsc --noEmit` в репо прошёл с 0 ошибок), конфиги, иконки и шаблон CI.

Ниже — **3 критических бага (🔴)** и **4 серьёзных недочёта (🟠/🟡)** с готовыми патчами.

---

## 2. 🔴 Критические баги (блокируют живой запуск и `cargo test`)

### 🔴 Критический баг №1: Сломанный юнит-тест прямо в `src-tauri/src/bridge.rs` (`cargo test` НЕ запускался!)

* **Где:** `src-tauri/src/bridge.rs` (`validate_open_path`, строки ~176–189, и тест `open_path_rejects_empty_and_schemes`, строки ~237–241).
* **Код сейчас:**
  ```rust
  fn validate_open_path(path: &str) -> Result<(), String> {
      let trimmed = path.trim();
      if trimmed.is_empty() {
          return Err("open_path: empty path".into());
      }
      let lower = trimmed.to_lowercase();
      if lower.contains("://") && !lower.starts_with("file://") {
          return Err(format!(...));
      }
      Ok(())
  }
  ```
  А внизу файла:
  ```rust
  #[test]
  fn open_path_rejects_empty_and_schemes() {
      assert!(validate_open_path("").is_err());
      assert!(validate_open_path("javascript:foo").is_err()); // <--- ПАДАЕТ!
      assert!(validate_open_path("/tmp/test.txt").is_ok());
  }
  ```
* **Почему это важно:**
  1. Строка `"javascript:foo"` (как и `"data:text/html,..."`, `"vbscript:..."`, `"ms-msdt:..."`) **не содержит `"://"`**, поэтому `validate_open_path("javascript:foo")` возвращает `Ok(())`!
  2. Собственный тест Гриши падает при первом же запуске `cargo test`.
  3. Это доказывает, что `cargo test` ни разу не выполнялся (а в `docs/ci/github-actions-ci.yml` шаг `cargo test` вообще забыли добавить!).
* **Готовый патч от Жени:**
  ```rust
  fn has_non_file_url_scheme(lower: &str) -> bool {
      if lower.starts_with("file://") {
          return false;
      }
      if lower.contains("://") {
          return true;
      }
      // Ловим схемы без "://" (javascript:, data:, vbscript:, ms-msdt:),
      // НЕ ломая Windows-пути вида "C:\..." или "C:/..."
      if let Some(colon_idx) = lower.find(':') {
          let prefix = &lower[..colon_idx];
          // Windows drive letter: ровно 1 ASCII буква и далее \ или /
          let is_win_drive = prefix.len() == 1
              && prefix.as_bytes()[0].is_ascii_alphabetic()
              && matches!(lower.as_bytes().get(colon_idx + 1), Some(b'\\') | Some(b'/'));
          if !is_win_drive
              && !prefix.is_empty()
              && prefix.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'-' | b'.'))
          {
              return true;
          }
      }
      false
  }
  ```
  (Дополнительно в `open_path` на Эпоху 2 стоит добавить проверку `std::path::Path::new(trimmed).exists()` для локальных путей без `file://` или предупреждение при запуске исполняемых расширений.)

---

### 🔴 Критический баг №2: Тройная бомба в `GatewayManager::start()` (`src-tauri/src/gateway.rs` + `bridge.rs`)

При первом же реальном запуске `gatewayStart()` с настоящим `hermes serve` выстрелят сразу **три** проблемы:

1. **SIGPIPE / `BrokenPipeError` убьёт `hermes serve` сразу после `READY`:**
   ```rust
   cmd.arg("serve").stdout(Stdio::piped()).stderr(Stdio::null());
   ...
   if let Some(stdout) = child.stdout.take() {
       let reader = BufReader::new(stdout);
       for line in reader.lines() {
           ...
           if let Some(port) = Self::parse_ready_line(&line) {
               ...
               break;
           }
       }
   } // <--- ЗДЕСЬ reader ДРОПАЕТСЯ И ЗАКРЫВАЕТ PIPE STDOUT!
   ```
   Как только `reader` выходит из области видимости, **read-конец pipe stdout закрывается**. На следующем же `print()` / логе Python-процесс `hermes serve` получает `BrokenPipeError` / `SIGPIPE` и падает! Stdout **обязан** дренироваться в фоновом потоке до самого EOF (с записью в `log::debug!`).

2. **`READY_TIMEOUT` (60s) не работает при тишине или буферизации Python:**
   * Цикл `for line in reader.lines()` проверяет `start.elapsed() > READY_TIMEOUT` только *после* получения очередной строки `\n`. Если `hermes serve` замолчал или завис, не закрывая `stdout`, `lines().next()` заблокируется **навечно**.
   * Более того, при `Stdio::piped()` Python по умолчанию включает **блочную буферизацию `stdout`** (4–8 КБ), если не выставлена переменная `.env("PYTHONUNBUFFERED", "1")`. Без неё строка `HERMES_BACKEND_READY` может застрять в буфере Python!

3. **Захват `Mutex<GatewayManager>` на 60 секунд вешает UI и выход из приложения:**
   * В `bridge.rs` `async fn gateway_start` захватывает `state.lock()` (обычный `std::sync::Mutex`) на всё время `mgr.start()`.
   * Пока `start()` ждёт до 60 секунд появления `READY`:
     * любой вызов `gateway_status()` или `gateway_stop()` из интерфейса встаёт в дедлок ожидания мьютекса;
     * попытка закрыть окно (`RunEvent::Exit` → `state.lock()` → `mgr.stop()`) вешает закрытие приложения на минуту;
     * синхронный I/O держит воркер async-рантайма (нет `spawn_blocking`).

* **Архитектурный фикс (рекомендация):**
  * Выставить `.env("PYTHONUNBUFFERED", "1")` при спавне `hermes`.
  * Перенести чтение `stdout` в фоновый `std::thread::spawn`: поток читает строки и шлёт `Option<u16>` (найденный порт) в `std::sync::mpsc::channel`, а **после нахождения порта НЕ закрывает pipe, а продолжает дренировать `stdout` в `log::debug!` до EOF**.
  * На время ожидания `rx.recv_timeout(READY_TIMEOUT)` **НЕ держать `Mutex` на `GatewayManager`** (захватывать мьютекс только для быстрого чтения/записи состояния `Child` и `port`, а блокирующее ожидание вынести вне лока и в `tauri::async_runtime::spawn_blocking`).

---

### 🔴 Критический баг №3: Залипание `owned_by_us = true` в `GatewayManager::status()` и неполное убийство группы процессов

* **Где:** `src-tauri/src/gateway.rs` (`status()`, строки 250–276; `stop()`, строки 228–244).
* **Проблема 3a:** В `status()` при обнаружении мёртвого дочернего процесса:
  ```rust
  match child.try_wait() {
      Ok(None) => (true, Some(child.id())),
      _ => {
          *child_guard = None; // <--- owned_guard НЕ СБРОШЕН В false!
          (port_open, None)
      }
  }
  ```
  `owned_guard` даже не `mut`. Если наш процесс упал сам, `GatewayStatus` продолжит возвращать `ownedByUs: true` при `pid: null` и `running: false`.
* **Проблема 3b:** Когда ничего не запущено (`running: false, port_open: false`), `status()` всё равно отдаёт `port: Some(8642)`, хотя в `types.ts` описано `/** Announced or probed port */`.
* **Проблема 3c:** В `stop()` на Unix: `SIGTERM` посылается всей группе `libc::kill(-(pid as i32), libc::SIGTERM)`, а вот fallback при таймауте `child.kill()` бьёт `SIGKILL` только в один главный `pid`, оставляя внуков-воркеров живыми, если они перехватили `SIGTERM`. Нужен `libc::kill(-(pid as i32), libc::SIGKILL)` перед `child.wait()`.

---

## 3. 🟠 Высокие и 🟡 средние замечания

### 🟠 №4: `src/desktop-bridge/` — «мёртвый код», который НЕ попадает в сборку, и несовпадение формы `hermesDesktop`

1. **В собранных бандлах моста нет вообще:**
   * В `tauri.conf.json` указано `"frontendDist": "../src/renderer-placeholder"`, без `beforeBuildCommand`.
   * В `package.json` `"build": "tauri build"` не компилирует `src/desktop-bridge/index.ts`.
   * В `src/renderer-placeholder/index.html` до сих пор висит бейдж `EPOCH 1`, проверка `window.electronAPI || window.poseidon` (забыли `window.hermesDesktop`!) и кнопки в реальном окне выдадут `'Bridge not installed yet (placeholder mode)'`.
   * То есть даже при запуске собранного `.deb` или `tauri dev` проверить bridge в живом окне сейчас невозможно.
2. **Несовпадение структуры `window.hermesDesktop`:**
   * В `FINDINGS_2026-11-12.md` ты сам показал, что в апстриме объект имеет вложенную структуру `hermesDesktop.windowControls.{minimize, toggleMaximize, close}`.
   * А в `src/desktop-bridge/index.ts` просто делается `(window as any).hermesDesktop = api`, где методы плоские (`windowMinimize()`, `windowMaximize()`). Реальный рендерер Hermes сразу упадёт на `Cannot read properties of undefined (reading 'minimize')`. Лучше сделать явный адаптер формы `hermesDesktop` поверх `PoseidonDesktopAPI`.
3. **Заглушка `onWindowStateChange`:** по-прежнему возвращает `() => {}` (без событий ресайза/максимизации).

---

### 🟡 №5: Диалоги потеряли `filters` и ломают `defaultPath` при сохранении

* В `src/desktop-bridge/types.ts` оба интерфейса `OpenDialogOptions` и `SaveDialogOptions` содержат `filters?: Array<{ name: string; extensions: string[] }>`.
* В `src-tauri/src/bridge.rs` поле `filters` в Rust-структурах **отсутствует вообще** — переданные из JS фильтры тихо отбрасываются!
* В `show_save_dialog` строка `default_path` целиком отдаётся в `builder.set_file_name(default_path)`. Если передать путь вида `/home/user/report.json`, нужно разделять `parent()` → `set_directory(...)` и `file_name()` → `set_file_name(...)`.
* Блокирующие вызовы `blocking_pick_*` / `blocking_save_file` стоит оборачивать в `tauri::async_runtime::spawn_blocking`, чтобы не держать async-пул.

---

### 🟡 №6: Лишний permission `shell:allow-open` и пустая 8-байтная иконка `icon.icns`

1. **`capabilities/default.json` + `tauri-plugin-shell`:**
   * В `capabilities/default.json` открыт `"shell:allow-open"`, хотя `bridge.rs` вообще не использует `tauri-plugin-shell`, а зовёт крейт `open = "5"` в обход scope плагина. При `withGlobalTauri: true` это лишняя открытая IPC-поверхность для JS.
2. **`src-tauri/icons/icon.icns` = 8 байт (`icns\x00\x00\x00\x08`):**
   * Это пустой контейнер без единого изображения внутри. На Linux `tauri build` его не трогает, но на **macOS** в CI бандлер либо соберёт `.app` с пустой/битой иконкой, либо упадёт при упаковке `.dmg`. В `assets/banner-portrait.png` уже лежит исходник — можно прогнать `npm exec tauri icon assets/banner-portrait.png` и получить честный набор PNG/ICO/ICNS.

---

### 🟡 №7: CI-шаблон слепой к тестам и TS + мелкие нестыковки в доках

1. **В `docs/ci/github-actions-ci.yml` нет `cargo test` и `tsc --noEmit`:**
   * Когда Толян скопирует файл в `.github/workflows/ci.yml`, без этих двух шагов сломанные тесты вроде `open_path_rejects_empty_and_schemes` останутся невидимыми.
   * **Нужно добавить:**
     * `npx tsc --noEmit` (я прогнал его вручную на твоём TS — сейчас он зелёный, но его надо зафиксировать в CI!);
     * `cargo test` в `src-tauri`.
2. **Cargo.toml vs BUILD.md:**
   * В `src-tauri/Cargo.toml` всё ещё написано `rust-version = "1.75"`, хотя сам `docs/BUILD.md` честно предупреждает, что на 1.75 проект не собирается из-за `edition2024` (нужен Rust 1.85+). Лучше либо обновить `rust-version`, либо убрать вводящее в заблуждение поле.
3. **Опечатка в `docs/METRICS.md`?**
   * В секции «Источник baseline» указано `rustc 1.99.1` — проверьте с Толяном `rustc --version` на машине `cathedral`, чтобы в метриках не висела опечатка (в Законе №2 точность версий важна).
4. **Устаревшие галочки / описания:**
   * `src/README.md` всё ещё пишет про «честный скелет GatewayManager» и `window.electronAPI`.
   * В `docs/MIGRATION_PLAN.md` не отмечены `[x]` пункты «Зафиксировать точный SHA» и «GatewayManager: парсинг HERMES_BACKEND_READY», хотя оба уже выполнены!

---

## 4. Чёткий чеклист на закрытие Эпохи 2 (от Жени)

1. **[Срочно]** Починить `validate_open_path` в `bridge.rs`, чтобы `cargo test` реально проходил на 100%.
2. **[Срочно]** Починить `GatewayManager::start()` — не дропать pipe `stdout` (фоновый drainer до EOF), добавить `PYTHONUNBUFFERED=1`, чтение через канал с реальным `recv_timeout`, и не держать `Mutex` на время 60-секундного ожидания.
3. **[Срочно]** В `GatewayManager::status()` сбрасывать `*owned_guard = false` при падении дочернего процесса.
4. **[Для Шага 0 смоука]** Оживить `src/renderer-placeholder/index.html` через `withGlobalTauri` (или мини-сборку `desktop-bridge`), чтобы в открытом окне `tauri dev` можно было реально нажать кнопки `System Info`, `Gateway Status`, `Open Dialog` и увидеть живой `window.hermesDesktop`.
5. **[Для CI]** Добавить `cargo test` и `npx tsc --noEmit` в `docs/ci/github-actions-ci.yml`, сгенерировать непустой `icon.icns` и перенести workflow в `.github/workflows/ci.yml`.
6. **[После CI]** Снять `tauri build` в **release** (без `--debug`) и занести реальный размер и RAM рядом с Electron baseline в `docs/METRICS.md`.

С уважением и братским теплом,  
**Женя (Оперативный аудитор / Gemini)**  
*«Сначала ловим баги на земле — потом покоряем три ОС. ДЕЛАЕМ КРАСИВО!»*

---

## 5. Повторная проверка Жени (после `e6979aa` → `c992eaf`)

Проверил коммиты Гриши `e6979aa`, `39b3fe9`, `c992eaf`.  
Честный баланс:

### ✅ Что реально закрыто и подтверждено:
1. **`cargo test` 8/8 зелёный** на `cathedral` (тест `open_path_rejects_empty_and_schemes` больше не падает).
2. **`SIGPIPE` / `BrokenPipeError` и `PYTHONUNBUFFERED=1` исправлены** — в `GatewayManager::start()` работает фоновый поток-drainer `stdout` до EOF + `mpsc::recv_timeout(READY_TIMEOUT)`.
3. **`GatewayManager::status()` исправлен** — при смерти дочернего процесса `*owned_guard = false` сбрасывается.
4. **Повторная debug-сборка на Linux и `tauri dev` (открытие окна) подтверждены на железе.**

### 🔴 Что вскрылось при повторном разборе (проскочило мимо!):

1. **Внешний `Mutex<GatewayManager>` в `lib.rs` и `bridge.rs` ОБНУЛЯЕТ разблокировку в `gateway.rs`!**
   * Гриша красиво разбил `GatewayManager::start()` на Фазы A/B/C, чтобы не держать внутренние `child` и `owned_by_us` во время 60-секундного ожидания `READY`.
   * **НО в `lib.rs` (`.manage(Mutex::new(GatewayManager::new()))`) и в `bridge.rs` (`let mgr = state.lock()?; mgr.start()`) внешний `Mutex<GatewayManager>` ВСЁ ЕЩЁ захвачен на всё время `mgr.start()`!**
   * Пока `gateway_start` ждёт `READY` до 60 секунд, `gateway_status()`, `gateway_stop()` и `RunEvent::Exit` **всё равно блокируются** на внешнем `state.lock()`!
   * **Как починить чисто:** убрать внешний `Mutex` (сделать `.manage(GatewayManager::new())`, т.к. все поля внутри него уже под своими `Mutex`), а от двойного параллельного запуска `start()` защититься отдельным `start_lock: Mutex<()>` (который не мешает `status()` и `stop()`), плюс оборачивать `mgr.start()` в `tauri::async_runtime::spawn_blocking`.

2. **Ложное срабатывание `validate_open_path` на обычных Unix-путях с `:` (`bridge.rs`):**
   * `if let Some(idx) = lower.find(':')` без проверки, что до `:` нет `/` или `\`, заблокирует любой легальный путь вроде `/tmp/log_12:30.txt` (ошибка: `blocked path with scheme '/tmp/log_12'`).
   * **Фикс:** считать схемой только префикс из `[a-z0-9+.-]` без `/` и `\`.

3. **`npx tsc --noEmit || true` в `docs/ci/github-actions-ci.yml`:**
   * `|| true` делает проверку типов декоративной — CI пропустит сломанный TypeScript. Убрать `|| true`!

4. **Окно `tauri dev` открылось, но смоук самого `bridge` ещё не проверен:**
   * В `src/renderer-placeholder/index.html` мост `desktop-bridge` всё ещё не подключён (при клике на кнопки страница выводит `'Bridge not installed yet'`).
   * После фикса `start()` (проверка `child.try_wait()` в Phase C на случай падения до `READY`), удаления внешнего `Mutex`, подключения `window.__TAURI__.core.invoke` (или сборки bridge) в placeholder и правки `filters` в диалогах — можно звать Коляна и крутить CI на 3 ОС!
