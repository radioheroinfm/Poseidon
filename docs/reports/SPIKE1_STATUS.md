# Spike 1 status — 2026-11-22

## Working
- Tauri v2 shell loads upstream Hermes `apps/desktop` (Vite :5174)
- `hermesDesktop` bridge + recursive stubs + WebSocket shim
- `ensure --json` + session-ticket (`interactive` for WS, `native-http` for REST)
- REST via `hermesDesktop.api` → `X-Hermes-Gateway-Ticket` → `{ profiles: [...] }`
- Onboarding UI: "Hermes Desktop is ready 100%"

## Likely hang root cause (fixed e5a8bd8)
`getGatewayWsUrl` returned `{ ok, wsUrl }` object; Electron/Hermes expects **string URL**.
Without string, `openGatewaySocket` never dials → setup stuck.

## Still polishing
- worktrees shape edge cases
- provider/setup completion path
- WebKit stability on Linux
