# Architecture Decision Records & Project Decisions

## ADR-001: Use Tauri v2 + system WebView instead of Electron
**Status**: Accepted  
**Date**: 2026-11-11

## ADR-002: Keep Python agent core and gateway unchanged for v1
**Status**: Accepted

## ADR-003: Preserve the three-party authority model (Shell / Renderer / Agent Backend)
**Status**: Accepted

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

Интерактивный дашборд в `/workspace` принимается как **внутренний инструмент команды**.  
Мы будем его использовать с пользой, но не развивать сильно. Основной фокус — миграция Hermes Desktop.

## ADR-007: Isomorphic Desktop Bridge (критично)
**Status**: Accepted  
**Date**: 2026-11-11  
**Источник**: Аудит Жени (Фаза 0)

React-рендерер Hermes остаётся максимально нетронутым.  
Создаём слой `desktop-bridge`, который снаружи выглядит как старый `window.electronAPI`, а внутри работает через Tauri `invoke` / `listen`.  
Это сохраняет возможность подтягивать обновления UI из апстрима.

## ADR-008: Clean Tauri v2 as foundation (not Pake-cli as base)
**Status**: Accepted  
**Date**: 2026-11-11  

Для полноценного Desktop идём в чистый Tauri v2 + официальные плагины.  
Pake может использоваться только для быстрых экспериментов.

## ADR-009: Proper Python Gateway lifecycle management
**Status**: Accepted  
**Date**: 2026-11-11  

В Rust сразу закладываем корректное управление жизненным циклом `hermes serve` (защита от зомби-процессов и блокировок SQLite).
