# Spike 1 — REST Unauthorized

`curl http://127.0.0.1:<port>/api/profiles` → `{"detail":"Unauthorized"}`

Hermes renderer `hermesApi` → `/api/profiles` needs the same auth as Electron.

Next: find how desktop attaches token/ticket to HTTP (Authorization / cookie / header).
WS already uses session-ticket subprotocol; REST may need a parallel mint.
