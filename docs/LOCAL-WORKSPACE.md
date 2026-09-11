# Самостоятельная рабочая папка

Вся текущая работа находится в `C:\work\app\reading-app`. Старые версии и исходный ZIP изображений сюда не включены.

- `docs/CONTENT-PLAN.md` — единый документ учебной программы.
- `content/`, `lib/`, `features/`, `components/` — материалы и код.
- `public/` — готовые изображения и модель распознавания для сайта.
- `materials/bukvar-part1.pdf` — локальная копия букваря для разработки программы. Не публикуется.
- `node_modules/` — собственные зависимости v4. Внутренние ссылки ведут только внутрь этой папки.
- `.local/node/bin/node.exe` — локальный Node.js для Windows.
- `.local/publish-auth/` — закрытые данные публикации. Не публикуются и не предназначены для передачи другим людям.
- `package.json`, `pnpm-lock.yaml` — состав и точные версии зависимостей для переустановки.

## Запуск из корня проекта

```powershell
powershell -ExecutionPolicy Bypass -File tools/project.ps1 dev
powershell -ExecutionPolicy Bypass -File tools/project.ps1 check
powershell -ExecutionPolicy Bypass -File tools/project.ps1 build
```

`dev` открывает локальный сервер на http://127.0.0.1:3024 (если порт занят, Vite сообщает другой). `check` проверяет типы, тесты и сборку сайта. `build` собирает dist-pages.

Публикация уже подготовленных коммитов: `powershell -ExecutionPolicy Bypass -File tools/project.ps1 publish`. Нужны установленный Git/OpenSSH и доступ к GitHub. Эти системные программы и браузер не входят в папку.

Прогресс ребёнка хранится в браузере, а не в папке проекта. Копирование проекта не переносит его.

При переносе папки на другой путь внутренние junction-ссылки зависимостей надо пересоздать из `.local/dependency-links.json` либо переустановить зависимости по lock-файлу. Не копировать связанные старые проекты: они больше не нужны для запуска v4.
