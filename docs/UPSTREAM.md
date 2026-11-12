# Upstream Hermes — фиксация источника правды

## Текущий статус

| Поле | Значение |
|------|----------|
| Репозиторий | https://github.com/NousResearch/hermes-agent |
| Ветка | `main` |
| Git SHA | `[API rate limit — не зафиксирован хэш]` |
| Preload path | `apps/desktop/electron/preload.ts` |
| Дата сверки | 2026-11-12 |
| Снимок | см. `docs/upstream/FINDINGS_2026-11-12.md` |

## Критические факты (2026-11-12)

1. Renderer API = **`window.hermesDesktop`**, не `window.electronAPI`
2. Backend ready = stdout `HERMES_BACKEND_READY port=<N>` (cold start до 60s)
3. Порт динамический, не hardcode 8642

Подробности: [FINDINGS_2026-11-12.md](./upstream/FINDINGS_2026-11-12.md)

## Правило

Любое утверждение «1:1 с Hermes» без актуальной сверки — нарушение Закона №2.
