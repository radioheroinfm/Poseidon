# Architecture Decision Records & Project Decisions

## ADR-001: Use Tauri v2 + system WebView instead of Electron
**Status**: Accepted  
**Date**: 2026-11-11  
**Reason**: Значительное снижение размера, памяти и времени старта при сохранении возможности использовать существующий React UI.

## ADR-002: Keep Python agent core and gateway unchanged for v1
**Status**: Accepted  
**Date**: 2026-11-11  
**Reason**: Снижает риск и позволяет получить ценность от нативной оболочки максимально быстро.

## ADR-003: Preserve the three-party authority model (Shell / Renderer / Agent Backend)
**Status**: Accepted  
**Date**: 2026-11-11

## ADR-004: Team model (three brothers)
**Status**: Accepted  
Grok — developer/architect  
Zhenya — operational auditor  
Kolyan — strategic auditor (deep reviews every 5–10 stages)

## ADR-005: Beauty as the highest priority
**Status**: Accepted (see MANIFEST.md)

## ADR-006: Workspace dashboard is an internal tool
**Status**: Accepted  
**Date**: 2026-11-11  
Интерактивный дашборд в `/workspace` — внутренний инструмент команды. Используем, но не развиваем в продукт.

## ADR-007: Isomorphic Desktop Bridge
**Status**: Accepted  
**Date**: 2026-11-11  
React-рендерер Hermes остаётся максимально нетронутым.  
Слой `desktop-bridge` прикидывается `window.electronAPI`.

## ADR-008: Clean Tauri v2 as foundation
**Status**: Accepted  
**Date**: 2026-11-11  
Основа — чистый Tauri v2 + официальные плагины. Pake — только для быстрых экспериментов.

## ADR-009: Proper Python Gateway lifecycle + Ownership Policy
**Status**: Accepted  
**Date**: 2026-11-11  
**Источник**: Аудит Жени + стратегический аудит Коляна

**Политика владения Gateway (важно):**

- Gateway один на машину и может обслуживать CLI, ботов, cron и Desktop одновременно.
- Poseidon Desktop **убивает** процесс Gateway **только если он сам его запустил** в этой сессии.
- Если Desktop обнаружил уже работающий Gateway — он только **подключается (attach)** и при закрытии окна **не трогает** процесс.
- Реализация: `GatewayManager` хранит флаг `owned_by_us: bool`.

Это защищает чужие сессии от случайного убийства.

## ADR-010: Long-term direction — gradual Rust rewrite ("Strangler Fig")
**Status**: Accepted (направление)  
**Date**: 2026-11-11  
**Источник**: Толян через Коляна

Конечная цель — постепенно переписать на Rust всё, что получится.  
Tauri-оболочка — первый кирпич.  
Протокол Gateway должен стать версионированным контрактом, чтобы компоненты можно было заменять по одному.

## ADR-011: Honest metrics
**Status**: Accepted  
**Date**: 2026-11-11  

Метрики размера и памяти всегда разделяем:
- Размер/память **чистой оболочки** (Tauri)
- Размер/память **оболочки + Python runtime** (если мы его бандлим)

Никаких нечестных сравнений «голый Tauri vs полный Electron-дистрибутив».

## ADR-012: Закрытие эпохи только при зелёном CI (Закон №11)
**Status**: Accepted  
**Date**: 2026-11-12  
**Источник**: Стратегический аудит Коляна (Отчёт №3)

Эпоха не может считаться закрытой, пока нет успешной сборки и минимального CI.  
Ощущение «всё готово» без компиляции — иллюзия.
