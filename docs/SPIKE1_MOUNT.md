# Spike 1 — Mount Hermes `apps/desktop` UI

## Principle
Не пишем свой чат. Берём renderer из `hermesagent/apps/desktop`.

## Upstream scripts (apps/desktop/package.json)

| Script | What |
|--------|------|
| `dev:renderer` | Vite **http://127.0.0.1:5174** |
| `build` | `node scripts/build.mjs` (production dist) |
| `preview` | Vite preview **4174** |

## Poseidon side

| Piece | Path |
|-------|------|
| Bootstrap inject | `src/desktop-bridge/poseidon-bootstrap.js` |
| Socket adapter | `PoseidonGatewaySocket` / `__POSEIDON_SOCKET_FACTORY__` |
| Tauri config (dev) | `configs/tauri.hermes-dev.json` → `devUrl: 5174` |
| Launcher | `scripts/dev-hermes-ui.sh` / `npm run dev:hermes-ui` |

## Cathedral — one command

```bash
cd ~/Projects/Poseidon
git fetch origin main:refs/remotes/origin/main && git reset --hard origin/main

# optional: export HERMES_DESKTOP=~/.hermes/hermes-agent/apps/desktop
npm run dev:hermes-ui
```

Скрипт:
1. Поднимает `npm run dev:renderer` в Hermes (порт 5174), если ещё не запущен
2. Запускает Tauri с `configs/tauri.hermes-dev.json`
3. Rust `eval` inject bootstrap (`hermesDesktop` + socket factory)

## Critical: socketFactory hook

Upstream dials via `openGatewaySocket` / `socketFactory`.  
Bootstrap выставляет:

```js
window.__POSEIDON_SOCKET_FACTORY__ = () => PoseidonGatewaySocket.connect()
```

Если Hermes UI всё ещё делает голый `new WebSocket` → 1006.  
Тогда нужен маленький патч в `apps/desktop/src/api/canonical-protocol.ts` (или alias в Vite):

```ts
// at top of openGatewaySocket
const factory = (window as any).__POSEIDON_SOCKET_FACTORY__;
if (typeof factory === 'function') return factory();
```

Либо через Vite `resolve.alias` на poseidon shim — без правки node_modules, только local overlay.

## Success criteria
- [ ] Hermes chat UI paints in Poseidon window
- [ ] Boot gets past «Starting Hermes…»
- [ ] Messages use Rust WS (`gateway-ws-frame`), not browser WebSocket
- [ ] One user message → agent response

## Fallback: production dist

```bash
cd ~/.hermes/hermes-agent/apps/desktop
npm run build
# point frontendDist at the built renderer folder (see build.mjs outDir)
```

## Log
`POSEIDON_ROOT` set by launcher → `logs/poseidon-ui.log` under project.
