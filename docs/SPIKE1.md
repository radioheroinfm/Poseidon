# Spike 1 — React Hermes inside Poseidon

## Goal
Настоящий UI Hermes в Tauri WebView + чат через gateway.

## Done
- [x] ensure --json + session-ticket mint
- [x] Canonical dial wire (`hermes-gateway-v1` + ticket subprotocol)
- [x] `probe_gateway_ws` → 101 + `gateway.ready` (cathedral)
- [x] ADR-015: WS owned by Rust
- [x] **`WsBridge`**: `gateway_ws_connect` / `send` / `close` + events `gateway-ws-frame` / `gateway-ws-status`

## Next
- [ ] Thin JS adapter (WebSocket-like) over invoke/listen
- [ ] Mount `apps/desktop` dist or Vite dev against Poseidon shell
- [ ] First chat message round-trip
- [ ] Origin-free path only (no browser WebSocket to gateway)

## Smoke (cathedral)
1. WS Connect → STATUS connected
2. FRAME with gateway.ready
3. WS Ping → response frame
4. WS Close
