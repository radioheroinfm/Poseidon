# WS_DIAL_WIRE

Репо `~/.hermes/hermes-agent`, SHA `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19` / `v0.23.0`. Только чтение.

**Прямой dial из renderer, main НЕ проксирует WS.** Main только (а) mintит ticket через control-сокет и отдаёт URL по IPC, (б) на upgrade перехватывает заголовки: `main.ts:8225-8235` → `session.defaultSession.webRequest.onBeforeSendHeaders` → `localGatewayDials.headers(details)` (`local-gateway.ts:360-383`): валидирует nonce из `pending`-map (one-use, `pending.delete`), сверяет `webContentsId`, `resourceType === 'webSocket'`, pathname; вычищает заголовки `Origin` и `X-Hermes-Gateway-Ticket`; трафик идёт renderer → `ws://127.0.0.1:<port>` напрямую.

## URL

Mint (main, `local-gateway.ts:353-355`): `ws://127.0.0.1:55057/api/ws?native_dial=<uuid>&ticket=<one-use>`.
Renderer-обработка (`apps/desktop/src/api/canonical-protocol.ts:12-22`, `openGatewaySocket`): если в URL есть `native_dial` — `parsed.searchParams.delete('ticket')`. **В query остаётся только `native_dial=<uuid>`**; ticket уходит из URL. Без `native_dial` — `new WebSocket(url)` как есть (remote/legacy, credential остаётся в query).

## CONSTRUCTOR

`canonical-protocol.ts:21`:

```ts
new WebSocket(parsed.toString(), [CANONICAL_GATEWAY_PROTOCOL, `hermes-gateway-ticket.${ticket}`])
// CANONICAL_GATEWAY_PROTOCOL = 'hermes-gateway-v1'   (canonical-protocol.ts:8)
```

Вызывается через `socketFactory`: `client.ts:586` `socketFactory: openGatewaySocket` → `apps/shared/src/json-rpc-gateway.ts:241` `this.options.socketFactory?.(wsUrl) ?? new WebSocket(wsUrl)` (дефолт — без protocols). `client.ts:357` по наличию `native_dial` ставит `nativeDial = canonical = true`.

## SUBPROTOCOL

Transform: **raw token с префиксом, без base64/JSON** — `hermes-gateway-ticket.<ticket>` вторым элементом массива protocols (первый — `hermes-gateway-v1`). Сервер читает заголовок `sec-websocket-protocol` (`hermes_cli/web_server_boundary.py:156-171`): нужен ровно один `hermes-gateway-ticket.*` И обязательно `hermes-gateway-v1` в наборе, иначе `invalid`/`none`; ticket = суффикс после `hermes-gateway-ticket.`. Redeem: `gateway/run_api.py:428` → `ticket_store.redeem(...)` (одноразово, TTL 30 с); при успехе accept с `subprotocol='hermes-gateway-v1'` (`run_api.py:490`, `tui_gateway/ws.py:638`). Origin на upgrade зачищен main, поэтому origin-гейт `run_api.py:432` для native dial проходит.

## POST_OPEN

Клиент, на событии `open` (`json-rpc-gateway.ts:284-297`): `channel.attach(transport)` → первый кадр клиент→сервер: JSON-RPC request `client.capabilities` с params `{desktop_local: true}` (`json-rpc-channel.ts:267-269`, только для desktop-local). Далее heartbeat `{"jsonrpc":"2.0","id":N,"method":"gateway.ping","params":{}}` (`json-rpc-channel.ts:628`) и replay-запросы `session.events.since` `{session_id, last_seen, replay_epoch?}` (`json-rpc-gateway.ts:597-608`). Wire: newline-delimited JSON-RPC в обе стороны (`tui_gateway/ws.py:3`).

Сервер сразу после accept шлёт первый кадр сервер→клиент (`tui_gateway/ws.py:651-657`):

```json
{"jsonrpc":"2.0","method":"event","params":{"type":"gateway.ready","payload":{"skin":{...},"change_events":true,"heartbeat":true,"replay_epoch":"...","session_authority":true}}}
```

Readiness: native dial считается ready сразу при open (`dial-readiness.ts`: `createDial(generation, native=true)` → settled сразу); public dial ждёт `gateway.ready` (таймаут 15 с).

## FILES

- `apps/desktop/src/api/canonical-protocol.ts` (8, 12-22)
- `apps/desktop/src/api/client.ts` (97, 329, 354-381, 586, 590-593)
- `apps/desktop/src/api/dial-readiness.ts` (begin/createDial)
- `apps/shared/src/json-rpc-gateway.ts` (230-297, 554-608)
- `apps/shared/src/json-rpc-channel.ts` (256-270, 563-628)
- `apps/desktop/electron/main.ts` (8218-8235)
- `apps/desktop/electron/local-gateway.ts` (335-383 — pending-map + headers hook)
- `hermes_cli/web_server_boundary.py` (156-171)
- `gateway/run_api.py` (347-490)
- `tui_gateway/ws.py` (3-4, 426, 636-657)
- `gateway/runtime_bootstrap.py` (redeem/mint, TTL 30 с)
