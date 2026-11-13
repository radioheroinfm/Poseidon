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

- [ ] Release-сборка + реальные размеры
- [ ] CI зелёный на 3 ОС (workflow template есть, нужен enable)
- [ ] Полный diff preload vs bridge
- [ ] Ужесточение CSP / handshake шлюза
- [ ] Electron baseline measurements
- [ ] `tauri dev` smoke (окно реально открывается и bridge жив)

## Артефакты первой сборки

```
Poseidon_0.1.0_amd64.deb     53.89 MiB
Poseidon-0.1.0-1.x86_64.rpm  53.89 MiB
Poseidon_0.1.0_amd64.AppImage 127.10 MiB
```
