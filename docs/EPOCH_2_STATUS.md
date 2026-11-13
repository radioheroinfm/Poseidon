# Эпоха 2 — ЗАКРЫТА (условно-полно по ADR-012 CI)

**Вердикт команды:** каркас принят, CI GREEN на 3 ОС, live IPC в окне, release ~4 MiB deb.

## Закрыто

- [x] Блокеры B1–B5
- [x] READY-протокол + ownership (R1 fixed)
- [x] Arc / spawn_blocking / stdout drainer
- [x] Security validation (open_*)
- [x] Upstream SHA `2bd378ed` / v0.23.0
- [x] cargo test 8/8
- [x] debug + **release** build (deb/rpm ~4 MiB)
- [x] `tauri dev` + live System Info / Gateway Status JSON
- [x] **CI GREEN** ubuntu + macOS + windows

## Сознательно перенесено в Эпоху 3+

- PRELOAD_MAP / полный контракт hermesDesktop (~166 keys)
- Spike 1: настоящий React Hermes в Tauri
- Discovery шлюза не только по 8642 (R3)
- icon.icns нормальный набор, Cargo.lock в репо
- Electron baseline measurements
- Письмо в Nous Research
