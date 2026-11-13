# Poseidon Metrics

> ADR-011: честные измерения.

## Release build (Linux x86_64) — 2026-11-13

| Артефакт | Размер | Примечание |
|----------|--------|------------|
| **deb** | **4.07 MiB** | Poseidon_0.1.0_amd64.deb |
| **rpm** | **4.08 MiB** | Poseidon-0.1.0-1.x86_64.rpm |
| **AppImage** | **83.88 MiB** | Poseidon_0.1.0_amd64.AppImage (тянет runtime) |

Host: cathedral · rustc 1.99.1 · commit ~`aca12f4` / release profile  
Лог: `docs/reports/BUILD_REPORT_2026-11-13.md` (debug) + этот release-замер.

## Debug build (для сравнения)

| Артефакт | Размер |
|----------|--------|
| deb | ~54 MiB |
| rpm | ~54 MiB |
| AppImage | ~127 MiB |

## Ещё не измерено

| Метрика | Статус |
|---------|--------|
| Холодный старт (окно) | ⏳ |
| RSS после старта / 30с | ⏳ |
| Electron Hermes Desktop baseline (та же машина) | ⏳ |
| Размер с бандленным Python runtime | n/a (пока оболочка only) |

## Методика

1. **Чистая оболочка** (Tauri only) — то, что выше.
2. **Оболочка + Python runtime** — когда/если бандлим.

Сравнение с Electron — только на той же машине, same-day, без подмены «голый Tauri vs полный дистрибутив».

## Upstream baseline target

- Hermes Desktop (Electron), SHA `2bd378ed` / v0.23.0
