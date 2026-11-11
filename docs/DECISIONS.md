# Architecture Decision Records & Project Decisions

## ADR-001: Use Tauri v2 + system WebView instead of Electron
**Status**: Accepted  
**Date**: 2026-11-11

**Context**: Hermes Desktop is currently Electron-based. Size, memory and startup cost are significant.

**Decision**: Migrate the Desktop shell to Tauri v2.

## ADR-002: Keep Python agent core and gateway unchanged for v1
**Status**: Accepted

## ADR-003: Preserve the three-party authority model
**Status**: Accepted

## ADR-004: Tandem work model with external auditor (Kolyan)
**Status**: Accepted  
**Date**: 2026-11-11

**Decision**: 
- Grok = главный разработчик и архитектор
- Колян (Claude Sonnet 5.5) = внешний критик-аудитор
- Полное равенство, дружеский братский этикет
- Все журналы и документация живут в `docs/`
- Главный закон — Манифест (`docs/MANIFEST.md`)

## ADR-005: Beauty as the highest priority
**Status**: Accepted (зафиксировано в Манифесте)
