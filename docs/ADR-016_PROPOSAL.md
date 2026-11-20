## ADR-016 (предложение Коляна): Транспорт шлюза — синхронный WebSocket-шим + Rust-дозвон

**Статус**: Proposed (ждёт решения Гриши, перепроверки Жени и результатов Spike 1)
**Контекст**: Гейт шлюза отвергает браузерный `Origin` (1006); Electron скрывает это `webRequest`-хуком, в Tauri такого нет (ADR-015). Апстримная `socketFactory` синхронна (`json-rpc-gateway.ts:241`), а наш `PoseidonGatewaySocket.connect()` возвращал Promise.
**Решение**:
1. Рендерер получает URL у `getGatewayWsUrl` (Rust выпускает тикет через control-socket), а создаёт сокет обычным `new WebSocket(url, protocols)`.
2. Глобальный `WebSocket` подменяется скриптом `initialization_script` (до кода страницы) на обёртку: loopback `ws://…/api/ws` → синхронный `PoseidonWebSocket`, остальное → родной.
3. `PoseidonWebSocket` дозванивается через команду `gateway_ws_open(id, url, protocols)`; Rust **валидирует** назначение (loopback, порт из `ensure`, путь `/api/ws`, подпротоколы из allowlist) и держит сессии по `id`.
4. Апстрим не патчится. Если Nous примет хук «инъектируемый транспорт», шим заменяется на него (вариант A «с поддержкой апстрима»).
**Последствия**: апстримная логика повторных попыток (8×3 с, перевыпуск тикета) работает без изменений; нужен единый источник бутстрапа (`poseidon-bootstrap.js`); безопасность: рендерер по-прежнему может запросить тикет `scope:host` → отдельный security-ADR (CSP, app manifest, `withGlobalTauri:false`).
**Отклонено**: B (Vite alias — не работает на production-`dist`), C (свой чат — второй UI, противоречит ADR-014).
