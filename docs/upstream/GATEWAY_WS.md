# Gateway WebSocket — upstream wire (v0.23.0)

**Source:** `docs/upstream/WS_DIAL_WIRE_2026-11-14.md`

## Minted URL (from main / Poseidon Rust)

```
ws://127.0.0.1:<port>/api/ws?native_dial=<uuid>&ticket=<one-use>
```

## Renderer dial (canonical)

1. If `native_dial` present: **delete `ticket` from query**
2. `new WebSocket(url, ['hermes-gateway-v1', 'hermes-gateway-ticket.' + ticket])`
3. Server accepts with subprotocol `hermes-gateway-v1`
4. Server → client first event: `gateway.ready` (JSON-RPC)
5. Client → server: `client.capabilities` `{desktop_local:true}`, then `gateway.ping`

Electron main strips `Origin` / validates `native_dial` pending map — Poseidon WebView may still send Origin; if 1006 persists, next is Origin handling.

Ticket is one-use, TTL 30s.
