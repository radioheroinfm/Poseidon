# Poseidon — Detailed Migration & Refactoring Plan

**Hermes Agent Desktop → Rust / Tauri (Pake-inspired)**

Version: 0.1 (2026-11-11)  
Status: Foundation phase

---

## Goals

1. **Primary**: Replace Electron shell of Hermes Desktop with a Tauri v2 application while preserving 100% of the React UI experience and full compatibility with the existing Python agent + gateway.
2. **Secondary**: Produce a dramatically smaller, faster, lower-memory native client.
3. **Tertiary**: Create clean seams that allow future selective rewriting of performance-critical agent pieces in Rust (not required for v1).
4. **Non-goals for v1**: Full rewrite of the Python agent core, changing the gateway protocol, or breaking existing CLI/TUI/messaging surfaces.

## Guiding Principles

- Keep the three-party authority model (Shell / Renderer / Agent Backend).
- Renderer stays pure React + Web technologies.
- All privileged operations move to Rust (via Tauri commands / events).
- Prefer reusing existing Hermes gateway WebSocket/JSON-RPC contracts.
- Ship incremental value: first a working lightweight client, then feature parity, then polish.
- Document every architecture decision.

## Phase 0 — Foundation (current)

**Deliverables**
- [x] This repository (Poseidon)
- [x] Architecture analysis (`docs/ARCHITECTURE.md`)
- [x] This migration plan
- [ ] Decision log (`docs/DECISIONS.md`)
- [ ] Banner assets and visual identity
- [ ] Contributor guidelines

**Exit criteria**: Clear shared understanding of current system and target architecture.

## Phase 1 — Discovery & Prototyping (1–2 weeks)

1. **Map every native capability** currently used by Desktop:
   - Window management, title bar, tray, multi-window
   - Global shortcuts
   - Notifications
   - Filesystem access (drag-drop, open/save, path resolution)
   - Clipboard (text + image)
   - External process / terminal launch
   - Updater mechanism
   - Secure storage / keyring
   - Auto-start / single-instance
   - OS-specific integrations (macOS menu, Windows AppUserModelID, etc.)

2. **Evaluate packaging strategies**:
   - Pure Pake CLI on the existing Webapp (fastest proof-of-concept)
   - Custom Tauri project that embeds the current React Desktop renderer
   - Hybrid: Tauri shell that can load either local bundled assets or remote Webapp URL

3. **Spike 1**: Package Hermes Webapp with `pake-cli` and document gaps.
4. **Spike 2**: Minimal Tauri + Vite + React skeleton that can open a WebSocket to a running Hermes gateway and display a live chat stream.

**Exit criteria**: Working “hello Hermes” Tauri binary < 15 MB that can talk to a local gateway.

## Phase 2 — Core Shell Migration (3–5 weeks)

1. Scaffold production Tauri v2 project inside `src/` (or `apps/desktop-tauri/`).
2. Port React renderer (almost 1:1 from `apps/desktop/src`).
3. Implement Rust command layer that mirrors the current Electron preload bridge:
   - `invoke("gateway_ensure")`, `invoke("open_path")`, `invoke("show_notification")`, etc.
4. Re-implement critical lifecycle:
   - Single instance
   - Window state persistence
   - Deep linking / protocol handlers if needed
   - Profile / multi-home awareness
5. Connect to both local gateway (`hermes gateway ensure`) and remote gateways (URL + token).
6. Basic updater story (tauri-plugin-updater or custom).

**Exit criteria**: Feature-complete local client for core chat + sessions + settings that can replace Electron for daily use by the team.

## Phase 3 — Feature Parity & Polish (4–6 weeks)

- Full native feature matrix (notifications, shortcuts, file browser, previews, voice, etc.)
- Packaging for macOS (universal if feasible), Windows (MSI / MSIX considerations), Linux
- Signing, notarization, Microsoft Store path (if desired)
- Performance & memory profiling vs Electron baseline
- Accessibility, internationalization, theming
- Documentation for end users and for Hermes core maintainers

## Phase 4 — Hardening & Handover

- Automated tests (UI + integration against real gateway)
- CI that builds all platforms
- Migration guide for existing Hermes Desktop users
- Optional: upstream PR / discussion with Nous Research about official Tauri path
- Performance comparison report

## Target Architecture (Tauri era)

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Shell (Rust)                        │
│  - Window / tray / menu / single-instance                    │
│  - Native capabilities (FS, clipboard, notifications…)       │
│  - Updater, auto-start, secure storage                       │
│  - Gateway lifecycle helper (ensure / attach)                │
└──────────────────────┬──────────────────────────────────────┘
                       │ Tauri IPC (commands + events)
┌──────────────────────▼──────────────────────────────────────┐
│                 React Renderer (WebView)                     │
│  - Same UI as current Desktop                                │
│  - Talks to Hermes gateway via WebSocket / JSON-RPC          │
│  - Uses Tauri APIs only through typed wrappers               │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Hermes Gateway + Agent Runtime                  │
│              (unchanged Python core)                         │
└─────────────────────────────────────────────────────────────┘
```

## Risk Register

| Risk | Mitigation |
|------|------------|
| Missing Electron APIs | Early capability audit + incremental replacement |
| WebView differences (esp. Linux) | Test matrix + feature detection |
| Updater complexity | Start with simple sideload + later Store |
| Team unfamiliar with Rust/Tauri | Pair programming, Pake as reference, good docs |
| Scope creep into core agent rewrite | Strict phase gates; core stays Python for v1 |

## Success Metrics (v1)

- Binary size ≤ 20 MB (ideally < 12 MB)
- Cold start significantly faster than Electron
- Memory usage ≤ 50% of Electron baseline under similar load
- All primary user journeys work (chat, sessions, settings, remote gateway, plugins)
- Zero regressions in session ownership / multi-surface consistency

## Next Immediate Actions

1. Create visual identity (banners in Cyberpunk + Van Gogh + Gaudí style).
2. Scaffold the Tauri project.
3. Produce the first Pake-packaged Webapp prototype.
4. Begin the capability matrix spreadsheet / document.

---

*This plan is living. All major changes go through DECISIONS.md.*
