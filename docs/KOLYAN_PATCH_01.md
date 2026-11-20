# kolyan-patch-01 — разблокировка Spike 1 (Poseidon)

Автор: Колян (аудитор). Основа: срез репозитория из `Poseidon-main (3).zip` (HEAD по статусу Гриши: `3ca51fa`).
**Важно (Закон №2):** Rust-часть написана **без компилятора** — проверить её можете только вы. JS-часть я прогнал сам: 11/11 тестов (`node --test`, Node 22). Всё, что ниже помечено «ожидаю», надо подтвердить на ваших хостах.

## Что закрывает

| Находка (Отчёт №6) | Что сделано |
|---|---|
| **W1** инъекция через `eval`+таймеры | Окно создаётся в `setup()` через `WebviewWindowBuilder::from_config(..).initialization_script(BOOTSTRAP_JS)` (в обоих конфигах `"create": false`). Бутстрап выполняется до скриптов страницы и при каждой загрузке (reload/HMR). `eval` и потоки с задержками удалены. |
| **W2** две реализации моста | Единственная реализация — `src/desktop-bridge/poseidon-bootstrap.js`. Рекурсивный Proxy (`profile.getDefault()` больше не падает), Tauri берётся лениво (больше нет `if (!invoke) return`). Старые TS-файлы не тронуты (tsc, CI). |
| **Вариант D** (шим сокета) | Синхронный `WebSocket`-шим: URL `ws://loopback:*/api/ws` → `PoseidonWebSocket` (сразу возвращает объект, `onopen` позже), всё остальное (Vite HMR) → родной `WebSocket`. Апстрим не патчится. |
| **N1** задержка 1 с | `ws_bridge.rs`: опрос 25 мс вместо 1 с. Тест `outbound_is_not_delayed_by_the_read_timeout` (< 400 мс). |
| **N2** одна сессия | Многосессионный `WsBridge` (id сокета от рендерера), события `gateway-ws-session-frame|status` с `{id, ...}`. |
| **N3** повторный `ensure`+минт | Новая команда `gateway_ws_open(id, url, protocols)` дозванивается по URL от рендерера; `get_gateway_ws_url` запоминает порт шлюза. |
| **N6 (часть)** | Валидация дозвона: только `ws://` loopback, порт из `ensure`, путь `/api/ws`, подпротоколы `hermes-gateway-v1` / `hermes-gateway-ticket.*`. `append_ui_log` ограничен (2 МиБ + ротация, 4000 символов на строку). |
| **Boot-trace** | Каждый `MISS/CALL/HIT hermesDesktop.*`, JS-ошибки, `console.error/warn`, loopback `fetch/XHR` и нативные WS пишутся в `logs/poseidon-ui.log` (тикеты вычищаются). Это и есть `BOOT_TRACE`, и «первая красная ошибка» без DevTools. |
| Совместимость | Старые команды и события (`gateway_ws_connect|send|close|status`, `gateway-ws-frame|status`) работают для `legacy`-сессии — смоук-кнопки плейсхолдера не сломаны. |

## Что НЕ входит (сознательно)
- **W3** формы `getConnection`/`getBootProgress` — их нужно брать из типов апстрима (`connection-config.ts`), я их не вижу. Boot-trace покажет, что рендерер реально читает.
- **W5** REST/`Origin` — патч только *логирует* loopback `fetch`/XHR (`[trace] NET-...`). Решение после появления данных.
- **N5** `GatewayManager` / `hermes serve` — не тронут: решение за Гришей (заморозить или переопределить под `ensure`).
- CSP, `withGlobalTauri`, app manifest — отдельный security-ADR.
- Windows: путь минта тикета по-прежнему unix-only. Зато loopback-тесты `ws_bridge` **выполняются и на Windows**, это проверка транспорта.

## Как применить (из корня репозитория, чистое рабочее дерево)

```bash
# Ubuntu (~/Projects/Poseidon)
cd ~/Projects/Poseidon
bash /путь/к/kolyan-patch-01/apply.sh        # создаёт ветку kolyan/patch-01 и применяет патч
bash scripts/kolyan-verify.sh                # автоматические проверки + лог в logs/
```
```powershell
# Windows 11 (после apply.sh в Git Bash, либо вручную: git apply ...\kolyan-patch-01.patch)
powershell -ExecutionPolicy Bypass -File scripts\kolyan-verify.ps1
```
Если патч не ложится (HEAD ушёл вперёд), `apply.sh` скопирует **полные файлы** из `files/` (новые/переписанные) и перечислит ручные правки для `bridge.rs`, `lib.rs`, двух конфигов, `package.json`, `ci.yml` — их небольшие, смотрите `git diff` в патче.

## Ожидаемые результаты
1. `npm run test:bridge` → 11/11. (У меня пройдено.)
2. `cargo test` → тесты `ws_bridge` (валидация, латентность, независимость сессий, server close) + прежние 10. **Не проверено мной.**
3. Если `cargo` ругнётся — пришлите **полный текст ошибки**, я правлю точечно (скорее всего это мелочи в сигнатурах Tauri: `WebviewWindowBuilder::from_config`, `initialization_script`).
4. Ручной смоук (`npm run dev:hermes-ui`): в `logs/poseidon-ui.log` ищем (а) `[poseidon] bootstrap kolyan-patch-01 installed`, (б) **первую** строку `[js-error]`/`[js-unhandled-rejection]`, (в) `[trace] MISS ...` (список ключей `hermesDesktop`), (г) `[trace] WS-SHIM open ...` без `[ws-shim] open failed`.

## Что прислать мне после прогона
`logs/kolyan-verify-*.log`, `logs/poseidon-ui.log`, скриншот окна (и текст первой красной ошибки, если окно белое).

## Распределение ролей (Закон «нашёл → предложил → смёржил автор → перепроверил другой»)
Гриша ревьюит и мёржит (его код), Женя перепроверяет, Колян проверяет итог по логам. Я правки в репозиторий не вношу.
