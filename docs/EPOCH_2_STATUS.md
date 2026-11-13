# Эпоха 2 — Статус

**Главная новость:** 🎉 первая успешная debug-сборка на Linux.

## Закрыто

- [x] Блокеры B1–B5
- [x] READY-протокол (`HERMES_BACKEND_READY`)
- [x] Security validation (open_external / open_path)
- [x] Exit cleanup для owned gateway
- [x] Upstream SHA: `2bd378ed` (v0.23.0)
- [x] **Первая зелёная сборка** (deb / rpm / AppImage debug)
- [x] **cargo test 8/8** после фиксов аудита №4
- [x] Повторная зелёная debug-сборка (e6979aa)
- [x] Поле `multiple` в диалогах подключено

## Ещё открыто

- [x] Release-сборка: deb 4.07 / rpm 4.08 / AppImage 83.88 MiB (2026-11-13)
- [ ] CI зелёный на 3 ОС (workflow template есть, нужен enable)
- [ ] Полный diff preload vs bridge
- [ ] Ужесточение CSP / handshake шлюза
- [ ] Electron baseline measurements
- [x] `tauri dev` smoke — окно открылось (подтверждено Толяном, 2026-11-13)
- [x] placeholder: live `__TAURI__` invoke — **подтверждено**: platform/linux, tauri 2.12.5

## Артефакты первой сборки

```
Poseidon_0.1.0_amd64.deb     53.89 MiB
Poseidon-0.1.0-1.x86_64.rpm  53.89 MiB
Poseidon_0.1.0_amd64.AppImage 127.10 MiB
```
