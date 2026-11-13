# Poseidon Metrics

> ADR-011: честные измерения.

## Первая успешная сборка (debug)

| Дата | Платформа | Метрика | Значение | Примечание |
|------|-----------|---------|----------|------------|
| 2026-11-12 | Linux x86_64 | deb (debug) | **53.89 MiB** | Poseidon_0.1.0_amd64.deb |
| 2026-11-12 | Linux x86_64 | rpm (debug) | **53.89 MiB** | Poseidon-0.1.0-1.x86_64.rpm |
| 2026-11-12 | Linux x86_64 | AppImage (debug) | **127.10 MiB** | Poseidon_0.1.0_amd64.AppImage |
| 2026-11-12 | Linux x86_64 | binary path | `.../debug/poseidon-desktop` | cargo target |

**Важно:** это **debug**-сборка (`--debug`). Release будет заметно меньше.  
Сравнение с Electron baseline — ещё не проводилось.

## Методика (как будем мерить дальше)

| Метрика | Как измеряем | Baseline |
|---------|--------------|----------|
| Размер установщика | артефакт `tauri build` (release) | Electron Hermes Desktop |
| Холодный старт | время до показа окна (avg 5) | Electron |
| Память (RSS) | после старта + 30с простоя | Electron |

## Разделение (обязательно)

1. **Чистая оболочка** (Tauri only)
2. **Оболочка + Python runtime** (если бандлим)

## Источник baseline

- Hermes Desktop (Electron), SHA: `2bd378ed` / v0.23.0
- Машина: cathedral (Linux), rustc 1.99.1
