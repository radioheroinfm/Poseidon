# Poseidon Source

## Структура

```
src/
├── desktop-bridge/          ← изоморфный слой (главный архитектурный трюк)
│   ├── index.ts
│   └── types.ts
├── renderer-placeholder/    ← временная заглушка (позже сюда аккуратно придёт React из Hermes)
└── README.md

src-tauri/
├── src/
│   ├── lib.rs               ← точка входа
│   ├── bridge.rs            ← tauri::command'ы
│   └── gateway.rs           ← lifecycle Python Gateway
├── Cargo.toml
├── tauri.conf.json
└── build.rs
```

## Главные решения

- **ADR-007**: React-рендерер Hermes почти не трогаем. Всё общение идёт через `desktop-bridge`, который прикидывается `window.electronAPI`.
- **ADR-009**: GatewayManager сразу написан с мыслью о RAII и защите от зомби-процессов.

## Текущий статус

Bridge-контракт определён.  
Базовые команды на Rust стороне есть.  
GatewayManager — честный скелет (ещё не спавнит реальный процесс).

Следующий большой шаг — сделать bridge полностью рабочим и подключить первые реальные вызовы.
