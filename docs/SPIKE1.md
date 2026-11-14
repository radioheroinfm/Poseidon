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

## JS adapter

`src/desktop-bridge/poseidon-gateway-socket.ts` — WebSocket-like API:

```ts
const ws = await PoseidonGatewaySocket.connect();
ws.onmessage = (ev) => console.log(ev.data);
ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'gateway.ping', params: {} }));
ws.close();
```

Cathedral: Connect/Ping confirmed; Adapter Ping exercises the same path.


See **SPIKE1_MOUNT.md** for mounting `apps/desktop` without reinventing UI.
