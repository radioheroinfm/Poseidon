
## Upstream reality check (2026-11-12)

Сверка с [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) `main`:

| Тема | Факт |
|------|------|
| Preload path | `apps/desktop/electron/preload.ts` |
| Renderer API | **`window.hermesDesktop`** (не `electronAPI`) |
| Backend ready | stdout: `HERMES_BACKEND_READY port=<N>` |
| Cold start | до 30–60s |
| Port | динамический (анонс в READY), не hardcode |

Подробности: [`docs/upstream/FINDINGS_2026-11-12.md`](./upstream/FINDINGS_2026-11-12.md)

Poseidon Desktop в Эпохе 2 закрывает нативный shell + lifecycle шлюза.  
Полный паритет огромного `hermesDesktop` API — Эпоха 3+.

---

# Hermes Agent — Architecture Analysis (Poseidon)

> **Важно (честность по Манифесту)**  
> Анализ выполнен на основе публичной документации и структуры репозитория [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) по состоянию на ноябрь 2026.  
> Конкретный git-коммит апстрима, по которому сверялись детали `window.electronAPI` / `preload.ts`, **пока не зафиксирован** и помечен как `[НЕ ПРОВЕРЕНО ДО КОНЦА]`.  
> Это будет закрыто отдельной задачей первой эпохи.

**As of late 2026 (v0.23.x)**

## 1. High-Level System Overview

Hermes is a **multi-surface personal AI agent**. One agent core, many ways to talk to it.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Entry Points / Surfaces                       │
│                                                                      │
│  CLI (cli.py)          TUI (ui-tui)         Desktop (Electron)       │
│  Webapp / Dashboard    ACP (editors)        Messaging Gateway        │
│  Batch / Library       Python API                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Gateway (long-running process)                   │
│  - Session ownership (one gateway owns every conversation)           │
│  - Platform adapters (25+)                                           │
│  - Authorization, pairing, hooks, cron                               │
│  - JSON-RPC / WebSocket / REST surfaces                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Agent Runtime (AIAgent)                       │
│  - Conversation / turn loop                                          │
│  - Prompt assembly (system + context + volatile)                     │
│  - Provider resolution & model calls                                 │
│  - Tool registry + dispatch                                          │
│  - Memory, skills, compression, subagents                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        Session Storage   Tool Backends    Providers
        (SQLite + FTS5)   (terminal x7,    (OpenAI, Anthropic,
                           browser, MCP,    local, OpenRouter…)
                           web, vision…)
```

Key invariant (v0.23+): **One gateway per machine owns every session**. All surfaces (CLI, TUI, Desktop, bots, cron, ACP) attach as clients. This eliminated dual-writing and lost messages.

## 2. Core Components

### 2.1 Agent Runtime
- Facade: `run_agent.py` → real loop in `agent/conversation_loop.py` + `agent/turn_*.py`
- Prompt builder with strict caching rules (per-conversation prompt caching is sacred)
- Tool orchestration via `model_tools.py` + `tools/registry.py` + `toolsets.py`
- Skills system + curator (agent writes its own skills)
- Memory: agent-curated + FTS5 session search + user modeling

### 2.2 Gateway
- `gateway/run.py` (facade) + many siblings
- Platform adapters (Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Teams, etc.)
- SessionStore, delivery, pairing, hooks, mirror, cron integration
- Serves the new **Webapp** (full Desktop workspace in browser)

### 2.3 Desktop Application (`apps/desktop/`)
Three strict authority boundaries:

| Party          | Owns                                      | Technology      |
|----------------|-------------------------------------------|-----------------|
| Electron shell | Process lifecycle, windows, FS, git, updater, native capabilities, preload bridge | Electron + TypeScript |
| React renderer | Navigation, presentation, ephemeral UI state, chat surface | React + Vite + nanostores / @assistant-ui |
| Agent backend  | Sessions, tools, models, streaming, all real work | Hermes gateway / `hermes serve` |

- Renderer never touches Node or Electron directly.
- Connects via typed JSON-RPC / WebSocket to the gateway (local or remote).
- Bundled packages ship a full runtime; can also attach to existing installs or remote gateways.
- Updater, MSIX / DMG / Microsoft Store packaging, signing, etc.

### 2.4 Other Surfaces
- CLI + TUI
- Web dashboard + new Webapp
- ACP adapter for editors
- Plugin system (platforms, tools, skills, providers)

### 2.5 State & Persistence
- `~/.hermes/` (profile-aware via `get_hermes_home()`)
- SQLite sessions with FTS5
- Config in YAML, secrets in `.env`
- Skills, memory, plugins live outside version control

## 3. Technology Stack (current)

- **Python 3.14** (core agent, gateway, tools) — ~70%
- **TypeScript / React** (Desktop, TUI, web) — ~26%
- Electron for Desktop
- SQLite + FTS5
- Multiple terminal backends (local, Docker, SSH, Modal, Daytona, Vercel Sandbox…)
- Package manager (`hermes pm`) with locked environments

## 4. Pain Points Relevant to Migration

1. Electron binary size and memory (classic problem).
2. Complex dual packaging (bundled runtime vs source install).
3. Native capability surface is larger than strictly necessary for many users.
4. Opportunity: the Desktop renderer is already a modern React app that can live inside a system WebView.
5. The Webapp already serves almost the full Desktop experience from the gateway — perfect first target for Pake-style packaging.

## 5. Why Tauri / Pake Approach

- System WebView (no Chromium)
- Rust for all privileged code (safer, faster, smaller)
- Installers typically 5–15 MB
- Excellent plugin ecosystem for shortcuts, notifications, window state, shell, etc.
- Natural path to gradually move more logic into Rust if desired later.

This analysis is the foundation for the migration plan in `MIGRATION_PLAN.md`.