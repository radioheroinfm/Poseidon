# Первая эпоха — Статус (готовность к оперативному аудиту)

**Цель первой эпохи:** заложить честный, безопасный и красивый фундамент Desktop-оболочки на Tauri.

## Что сделано

| Компонент | Статус | Комментарий |
|-----------|--------|-----------|
| Изоморфный `desktop-bridge` | ✅ | Контракт + mock/Tauri, ставится в `window.electronAPI` |
| Политика владения Gateway | ✅ | `owned_by_us` — убиваем только свой процесс |
| Discover по порту | ✅ | TCP connect на 8642 |
| Реальный spawn `hermes serve` | ✅ | Поиск бинарника + process group + SIGTERM |
| Базовые Tauri commands | ✅ | system, window, shell, gateway |
| Capabilities / CSP | ✅ | Минимальный безопасный набор |
| Честные ADR | ✅ | Включая ownership и strangler-fig направление |
| Структура проекта | ✅ | Чистая и понятная |

## Что ещё не закрыто (честно)

- [ ] Реальный `tauri dev` / первая успешная сборка в этой среде
- [ ] Полная интеграция `installDesktopBridge()` в production renderer
- [ ] Иконки приложения
- [ ] PID чужого процесса в attach-режиме
- [ ] Диалоги (showOpenDialog / showSaveDialog) — команды есть, плагин dialog ещё не подключён

## Главные файлы для аудита

- `src/desktop-bridge/` — изоморфный слой
- `src-tauri/src/gateway.rs` — lifecycle + ownership
- `src-tauri/src/bridge.rs` — команды
- `src-tauri/capabilities/default.json` — permissions
- `docs/DECISIONS.md` — ADR-009 и остальные
- `docs/EPOCH_1_STATUS.md` — этот файл

## Принцип

Где не готово — честно написано. Никаких иллюзий.
