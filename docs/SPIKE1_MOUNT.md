# Spike 1 — Mount Hermes `apps/desktop` UI

## Principle
Не пишем свой чат. Берём renderer из `hermes-agent/apps/desktop`.

## Constraints (Poseidon)
1. **No browser WebSocket to gateway** — Origin gate (ADR-015).  
   Inject / replace gateway transport with `PoseidonGatewaySocket`.
2. **`window.hermesDesktop`** — our nested P0 + stubs; grow from boot trace.
3. Shell window is Tauri (frameless + windowControls already mapped).

## Recommended path

### Phase A — static host (fastest feedback)
1. Build Hermes desktop frontend once:
   ```bash
   cd ~/.hermes/hermes-agent/apps/desktop
   # package scripts as upstream documents (vite build)
   npm run build   # or pnpm — use whatever lockfile says
   ```
2. Point Tauri `frontendDist` / devUrl at that `dist` **or** copy dist into `Poseidon/hermes-ui-dist/`.
3. Preload equivalent: load `install-hermes-desktop.ts` + `PoseidonGatewaySocket` before app JS.
4. Patch (or alias) upstream `openGatewaySocket` / `socketFactory` → Poseidon adapter.

### Phase B — dev loop
- Vite dev server for `apps/desktop` with `tauri dev` `devUrl`.
- Same inject of hermesDesktop + socket factory.

### Transport hook (critical)
Upstream (`client.ts`): `socketFactory: openGatewaySocket`.  
Poseidon must provide:
```ts
window.__POSEIDON_SOCKET_FACTORY__ = () => PoseidonGatewaySocket.connect()
// or patch module graph so openGatewaySocket uses adapter
```

Without this, UI will call `new WebSocket` → 1006 again.

## Out of scope for first mount
- Full 166-key hermesDesktop parity (stubs cover the rest)
- OAuth remote gateways
- Plugin WS

## Success criteria
- [ ] Hermes chat UI paints in Poseidon window
- [ ] Boot gets past «Starting Hermes…»
- [ ] One user message → agent response via Rust WS bridge
