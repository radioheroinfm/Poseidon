# Gateway WebSocket — upstream facts (v0.23.0 / 2bd378ed)

**Source:** `docs/upstream/HERMES_FACTS_2026-11-14.md` (local probe)

## getGatewayWsUrl return shape

```ts
{ ok: true, wsUrl: string } | { ok: false, error: string, needsOauthLogin?: true }
// renderer also tolerates bare string
```

## URL assembly

```
ws://127.0.0.1:<port>/api/ws?native_dial=<uuid>&ticket=<one-use>
// cached descriptor may show native_dial=unminted
// remote token mode: ?token=
// remote OAuth: ?ticket= (re-mint every connect)
```

Path is always `/api/ws` (+ optional base path prefix).

## Local auth

- **Not** a static token in URL for local spawn.
- Ticket minted via unix socket `~/.hermes/gateway.sock` (`session-ticket` JSON protocol).
- Desktop main: `hermes gateway ensure --json` → endpoint, then mint ticket on each connect.

## Discovery (not port 8642)

Per-home under `~/.hermes`:
- `gateway.sock`, `gateway.pid`, `gateway.lock`, `gateway_state.json`

Second `hermes serve` loses host flock → exit **75** (attach / refuse).

READY stdout still: `HERMES_BACKEND_READY port=<N>` for child spawn path.
