# ENSURE_JSON

Команда (выполнена на cathedral, 2026-11-14 ~19:17):

```
HERMES_HOME=/home/thomas/.hermes hermes gateway ensure --json
```

exit code: `0`, stderr пустой. Stdout целиком (секретов в выводе нет — credentials в нём не фигурируют):

```json
{"client_code_sha":"2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19","detail":null,"endpoint":{"api_origin":"http://127.0.0.1:55057","authority_epoch":113,"capabilities":["durable-admission-v1","event-replay-v1","session-authority-v1"],"code_sha":"2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19","control_home":null,"instance_id":"e48b797961cd4f529626b613d3a8ff52","profile_id":"/home/thomas/.hermes","runtime_protocol":1,"supervisor":"systemd"},"reason_code":null,"state":"ready"}
```

Структура: `{state, reason_code, detail, client_code_sha, endpoint:{api_origin, authority_epoch, capabilities[], code_sha, control_home, instance_id, profile_id, runtime_protocol, supervisor}}`. `state:"ready"` — шлюз уже запущен (pid 3028), ensure только вернул дескриптор.

# GATEWAY_STATE

`~/.hermes/gateway_state.json` (актуальный на момент съёма; секретов нет):

```json
{
  "pid": 3028,
  "kind": "hermes-gateway",
  "argv": ["/home/thomas/.hermes/hermes-agent/hermes_cli/main.py", "gateway", "run"],
  "start_time": 1247,
  "hermes_home": "/home/thomas/.hermes",
  "gateway_state": "running",
  "exit_reason": null,
  "restart_requested": false,
  "active_agents": 3,
  "platforms": {
    "telegram":          {"state": "connected", "error_code": null, "error_message": null, "updated_at": "2026-11-14T18:16:50.639008+00:00", "writer_pid": 3028, "writer_start_time": 1247, "needs_attention": false, "retrying_since": null},
    "cathedral:telegram": {"state": "connected", "error_code": null, "error_message": null, "needs_attention": false, "retrying_since": null, "updated_at": "2026-11-14T19:16:29.090825+00:00", "writer_pid": 3028, "writer_start_time": 1247},
    "thomas:telegram":    {"state": "connected", "error_code": null, "error_message": null, "needs_attention": false, "retrying_since": null, "updated_at": "2026-11-14T18:39:44.236274+00:00", "writer_pid": 3028, "writer_start_time": 1247}
  },
  "session_store": {"status": "ok"},
  "updated_at": "2026-11-14T19:17:15.432680+00:00",
  "code_sha": "2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19",
  "code_version": "0.23.0",
  "multiplex_standalone_reason": null,
  "served_profiles": ["default", "cathedral", "thomas"],
  "active_work": null,
  "parked_profiles": {}
}
```

# SESSION_TICKET_PROTOCOL

Источник: `apps/desktop/electron/local-gateway.ts:658-682` (клиент) и `gateway/control_socket.py:323-397` (сервер).

**Запрос** — одна JSON-строка + `\n` в unix-сокет `~/.hermes/gateway.sock` (или pointer из `gateway.sock.path`; на Windows — named pipe / python-клиент). Точная форма из `local-gateway.ts:664`:

```json
{"protocol":1,"id":1,"verb":"session-ticket","params":{"profile_id":"/home/thomas/.hermes","instance_id":"<endpoint.instance_id>","purpose":"interactive","scope":"host"}}
```

- `purpose`: один из `'interactive' | 'native-http' | 'native-profile-create' | 'native-profile-registry'` (`local-gateway.ts:488`); для WS-чата Desktop — `'interactive'`.
- `scope:'host'` добавляется только для `interactive` (`ticketScope`, `local-gateway.ts:621-623`) — тогда сокет может выбирать любой из served profiles; по умолчанию `scope:'profile'`.
- Сервер принимает только ключи `params`: `profile_id, instance_id, purpose, scope, subject, restart_wait` (`control_socket.py:376`); лишние ключи или `protocol != 1` → `PermissionError`. Peer должен пройти same-uid проверку (`_posix_peer_subject`, uid == uid владельца home).

**Успешный ответ** — одна JSON-строка + `\n`. Обёртка (`control_socket.py:337-341, 354-355`) + grant (`control_socket.py:392-397`):

```json
{"ok":true,"protocol":1,"id":1,"result":{"ticket":"<secrets.token_urlsafe(32)>","expires_in_seconds":30,"instance_id":"<ticket_store.instance_id>","profile_id":"/home/thomas/.hermes","runtime_protocol":1}}
```

Клиент валидирует (`local-gateway.ts:676`): `reply.ok === true`, `reply.protocol === 1`, `reply.id === 1`, `grant.instance_id === endpoint.instance_id`, `grant.profile_id === home`, `typeof grant.ticket === 'string'`; иначе — `Invalid gateway ticket`. Ticket одноразовый, TTL 30 с (`gateway/runtime_bootstrap.py: TTL_SECONDS=30`), redeem удаляет запись. Внутренний grant (хранится сервером, `runtime_bootstrap.py:53-55`): `{instance_id, profile_id, subject, purpose, capabilities, scope, refuse_restart_wait}`; capabilities для `interactive` = `session:create, session:read, session:submit, session:control, session:approve, session:respond`.

Ошибки: `{"ok":false,"error":"PermissionError: ...","protocol":1,"id":1}` — неверный instance → `stale runtime instance`, чужой/отсутствующий peer → `authenticated runtime bootstrap unavailable` / `invalid bootstrap envelope`.

**Как ticket попадает в URL** (`local-gateway.ts:353-355`): `ws://127.0.0.1:55057/api/ws?native_dial=<uuid>&ticket=<ticket>` — nonce живёт 25 с в `pending` map main-процесса (ключ — nonce, не URL), ticket в query уходит только на этот dial.
