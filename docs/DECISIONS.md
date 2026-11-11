# Architecture Decision Records

## ADR-001: Use Tauri v2 + system WebView instead of Electron

**Status**: Accepted  
**Date**: 2026-11-11

**Context**: Hermes Desktop is currently Electron-based. Size, memory and startup cost are significant. The UI is already a modern React application.

**Decision**: Migrate the Desktop shell to Tauri v2, using the system WebView and a Rust backend for all privileged operations. Inspiration and packaging patterns taken from Pake.

**Consequences**: Much smaller binaries, lower resource usage, safer native code. Requires rewriting the native bridge and packaging pipeline. React UI can be largely reused.

## ADR-002: Keep Python agent core and gateway unchanged for v1

**Status**: Accepted

The value of Hermes lives in its agent loop, skills, memory and multi-platform gateway. Rewriting that in Rust is a multi-year effort and is explicitly out of scope for the Poseidon Desktop migration.

## ADR-003: Preserve the three-party authority model

**Status**: Accepted

Shell (now Rust/Tauri) owns the machine. Renderer owns presentation. Agent backend owns the work. This separation has proven robust and will be maintained.
