# Upstream Hermes — фиксация источника правды

## Текущий статус

| Поле | Значение |
|------|----------|
| Репозиторий | https://github.com/NousResearch/hermes-agent |
| Ветка / тег | `v0.23.0` |
| Git SHA | **`2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`** |
| Preload path | `apps/desktop/electron/preload.ts` |
| Дата сверки | 2026-11-12 |
| Источник | Локальный клон + сборка на машине Толяна (отчёт BUILD_REPORT) |

## Критические факты

1. Renderer API = **`window.hermesDesktop`** (один `exposeInMainWorld`, ~166 ключей верхнего уровня)
2. Backend ready = stdout `HERMES_BACKEND_READY port=<N>` (cold start до 30–60s)
3. Порт динамический

Подробности: [FINDINGS_2026-11-12.md](./upstream/FINDINGS_2026-11-12.md)

## Правило

Любое утверждение «1:1 с Hermes» без актуальной сверки — нарушение Закона №2.
