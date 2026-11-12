# Upstream Hermes — фиксация источника правды

## Зачем

Колян справедливо потребовал: не писать «соответствует preload.ts», пока нет SHA и сверки.

## Текущий статус

| Поле | Значение |
|------|----------|
| Репозиторий | https://github.com/NousResearch/hermes-agent |
| Тег / ветка | `[НЕ ЗАФИКСИРОВАНО]` |
| Git SHA | `[НЕ ЗАФИКСИРОВАНО]` |
| Дата сверки | — |
| Снимок `apps/desktop/src/preload.ts` | нет |

## Как закрыть (Шаг 3 Эпохи 2)

1. Клонировать/обновить hermes-agent
2. Записать `git rev-parse HEAD` и тег (если есть)
3. Скопировать `apps/desktop/src/preload.ts` → `docs/upstream/preload.ts.snapshot`
4. Пройтись diff’ом по методам vs `src/desktop-bridge/types.ts`
5. Обновить таблицу выше и `ARCHITECTURE.md`

## Правило

Любое утверждение «1:1 с Hermes» без заполненной таблицы — нарушение Закона №2 (честность).
