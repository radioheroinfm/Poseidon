# Сборка Poseidon Desktop

## Требования

- **Rust** 1.77+ (лучше stable свежий; 1.75 может не потянуть зависимости Tauri 2)
- **Node.js** 20+
- **Системные библиотеки** (Linux): `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

## Быстрый старт

```bash
# 1. Зависимости фронта
npm install

# 2. Разработка
npm run dev
# или
npm run tauri -- dev

# 3. Релизная сборка
npm run build
```

## Что сейчас известно

- В среде разработки агента (Rust 1.75) полная сборка Tauri 2 **не проходит** из-за `edition2024` у транзитивных крейтов.
- CI (GitHub Actions) настроен на `ubuntu-latest` / `macos-latest` / `windows-latest` со stable Rust — там сборка должна быть возможна.
- Иконки — минимальные плейсхолдеры. Для релиза заменить через `npm exec tauri icon <source.png>`.

## Честность

Пока CI не зелёный на трёх ОС — Эпоха 2 не закрывается (ADR-012).

## CI

Файл workflow подготовлен в `docs/ci/github-actions-ci.yml`.

Текущий GitHub PAT не имеет scope `workflow`, поэтому автоматический push в `.github/workflows/` отклонён.
Чтобы включить CI:

1. Добавьте scope `workflow` токену, **или**
2. Вручную скопируйте `docs/ci/github-actions-ci.yml` → `.github/workflows/ci.yml` через UI GitHub.
