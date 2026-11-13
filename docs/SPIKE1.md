# Spike 1 — React Hermes inside Poseidon

## Goal

Настоящий UI Hermes (не placeholder) в Tauri WebView, подключённый к `hermes serve` через WS.

## Strategy

1. **Shell ready (now)**  
   Poseidon owns window + process lifecycle + `get_gateway_ws_url` / `gateway_ensure`.

2. **API surface**  
   Grow `window.hermesDesktop` only from PRELOAD_MAP P0.  
   Missing methods: stub with safe no-op / rejected promise logged once — so renderer boot doesn't die hard.

3. **Frontend swap**  
   Options (pick after probe):
   - A. Point `frontendDist` / devUrl at built `apps/desktop` dist from hermes-agent
   - B. Serve Vite dev of hermes desktop against Tauri
   - C. Minimal web client that only speaks gateway WS (if full renderer too heavy)

4. **Connection**  
   On boot: `gateway_ensure` → `get_gateway_ws_url` → feed renderer via `getConnection` / `getGatewayWsUrl`.

## Local probe (Толян / Гермес)

```bash
# in hermes-agent checkout
git rev-parse HEAD  # expect 2bd378ed or note drift
# run desktop once, DevTools → which hermesDesktop.* called on first chat paint
```

## Success

- [ ] Window shows Hermes chat UI  
- [ ] Can send a message and get a response via local gateway  
- [ ] Closing Poseidon does not kill attached-only gateway; kills owned gateway  
