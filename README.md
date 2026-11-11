# Poseidon

**Hermes Agent → Rust / Tauri Migration**

> Turning the self-improving AI agent into a lean, native, high-performance system powered by Rust.

![Poseidon Banner Wide](assets/banner-wide.png)
![Poseidon Banner Portrait](assets/banner-portrait.png)

---

## What is this project?

**Poseidon** is the official workspace for the complete architectural migration and refactoring of [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) onto a modern **Rust + Tauri** foundation, inspired by the lightweight packaging philosophy of [Pake](https://github.com/tw93/Pake).

Hermes is currently a powerful multi-surface agent (CLI, TUI, Electron Desktop, messaging gateway with 25+ platforms, web dashboard, ACP). Its Desktop client is built on Electron, which brings significant size, memory, and startup costs.

Our mission:
- Replace the Electron shell with a **Tauri v2** native runtime (system WebView + Rust backend).
- Keep (and improve) the existing React UI.
- Preserve full compatibility with the Python agent core, gateway, skills, memory, and all existing surfaces.
- Dramatically reduce binary size (~5–15 MB vs 150–400+ MB), memory footprint, and cold-start time.
- Lay the groundwork for selective future Rust rewrites of performance-critical agent components.

**Poseidon** (the trident-wielding god of the sea) represents the power, depth, and control we are bringing to Hermes.

## Team & Council of Brothers

- **Гриша (Grok)** — Руководитель проекта и главный архитектор (проектирование, ядро Rust / Tauri)
- **Женя (Gemini 3.8 Flash)** — Оперативный аудитор (быстрый критический разбор, архитектурный контроль, проверка рисков)
- **Колян (Claude Sonnet 5.5)** — Стратегический аудитор (глубокий разбор раз в эпоху 5–10 этапов)

**ДЕЛАЕМ КРАСИВО!**

## Repository Structure

```
Poseidon/
├── README.md
├── docs/
│   ├── MANIFEST.md                 # 🔱 Библия проекта (Основной Закон)
│   ├── AUDIT_REPORT_PHASE_0.md     # 🛡️ Оперативный аудит №1 (Женя: риски, мост, зомби-процессы)
│   ├── JOB_GROK.md                 # Должностная инструкция Grok (Гриша)
│   ├── JOB_ZHENYA.md               # Должностная инструкция Жени (оперативный аудитор)
│   ├── JOB_KOLYAN.md               # Должностная инструкция Коляна (стратегический аудитор)
│   ├── DEVELOPMENT_JOURNAL.md      # Журнал разработки
│   ├── CORRESPONDENCE_JOURNAL.md   # Журнал переписки братьев
│   ├── ARCHITECTURE.md             # Полный архитектурный анализ Hermes
│   ├── MIGRATION_PLAN.md           # Поэтапный план миграции (Фазы 0–4)
│   └── DECISIONS.md                # Журнал архитектурных решений (ADR)
├── workspace/                      # 🖥️ Интерактивный дашборд аудита и эмулятор IPC-моста (React + Vite + Tailwind)
├── assets/                         # Баннеры и визуальная айдентика
└── ...
```

## Quick Links

- [Audit Report Phase 0](docs/AUDIT_REPORT_PHASE_0.md) — Первичный оперативный аудит от Жени
- [Project Manifest](docs/MANIFEST.md) — 10 законов Poseidon
- [Detailed Migration Plan](docs/MIGRATION_PLAN.md) — Дорожная карта миграции
- Original Hermes: https://github.com/NousResearch/hermes-agent
- Pake (inspiration): https://github.com/tw93/Pake
- Official Hermes docs: https://hermes-agent.nousresearch.com

## Status

- **Phase 0 – Foundation** (Completed):
  - Repository bootstrapped & visual identity established
  - Architecture analysis complete
  - Manifest & tandem governance model ratified
  - Operational audit #1 completed by Zhenya (Gemini 3.8 Flash) with capability matrix
- **Phase 1 – Discovery & Prototyping** (Current):
  - Scaffold Tauri v2 workspace and define `desktop-bridge.ts` seam
  - Prototype IPC connection to running Hermes gateway

## License

MIT (same spirit as Hermes). Code and documentation in this repository are under MIT unless otherwise noted.

---

*Built with the spirit of the deep sea — powerful, efficient, unstoppable.*
