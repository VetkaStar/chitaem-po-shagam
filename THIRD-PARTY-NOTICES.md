# Уведомления о сторонних компонентах

Подготовлено 19.11.2026 для версии ветки new-design на коммите 5a0624c923da79b39d9c15762a0ef019b9e786de; состав ветки main может отличаться. Этот реестр охватывает 21 npm-пакет/версию с JavaScript и два пакета CSS, обнаруженные в локальной сборке Vite без записи результата (`write: false`), включая worker и отдельные WASM-файлы. Он не утверждает, что изменения уже попали в публичную сборку. Состав нужно пересмотреть при обновлении зависимостей.

**Набор не завершён:** для четырёх установленных пакетов обнаружена только метка MIT в `package.json`, без отдельного файла LICENSE. Происхождение компонентов и сопутствующих уведомлений ряда WASM также не установлено. Не считать документ исчерпывающим уведомлением до разрешения пунктов ниже.

В `public/third-party-licenses/npm/` сохранены полные лицензии в неизменном виде из соответствующих установленных пакетов. Ни в одном из этих 23 установленных пакетов при поиске отдельного файла `NOTICE`, `NOTICE.txt`, `NOTICES`, `NOTICES.txt` или `ThirdPartyNotices.txt` не найдено. Это не устанавливает отсутствие таких документов в исходных репозиториях или у встроенных бинарных компонентов. Лицензионные файлы других имён могут существовать внутри артефактов.

## Зависимости JavaScript и CSS

| Компонент | Версия | Метка пакета | Оригинальный локальный текст и авторы | Источник |
|---|---|---|---|---|
| `@base-ui/react` | `1.7.0` | MIT | [LICENSE](public/third-party-licenses/npm/base-ui-react@1.7.0/LICENSE)<br>Copyright (c) 2019 Material-UI SAS | [npm](https://www.npmjs.com/package/@base-ui/react/v/1.7.0) · [репозиторий](https://github.com/mui/base-ui) |
| `@base-ui/utils` | `0.3.2` | MIT | [LICENSE](public/third-party-licenses/npm/base-ui-utils@0.3.2/LICENSE)<br>Copyright (c) 2019 Material-UI SAS | [npm](https://www.npmjs.com/package/@base-ui/utils/v/0.3.2) · [репозиторий](https://github.com/mui/base-ui) |
| `@floating-ui/core` | `1.8.0` | MIT | [LICENSE](public/third-party-licenses/npm/floating-ui-core@1.8.0/LICENSE)<br>Copyright (c) 2021-present Floating UI contributors | [npm](https://www.npmjs.com/package/@floating-ui/core/v/1.8.0) · [репозиторий](https://github.com/floating-ui/floating-ui) |
| `@floating-ui/dom` | `1.8.0` | MIT | [LICENSE](public/third-party-licenses/npm/floating-ui-dom@1.8.0/LICENSE)<br>Copyright (c) 2021-present Floating UI contributors | [npm](https://www.npmjs.com/package/@floating-ui/dom/v/1.8.0) · [репозиторий](https://github.com/floating-ui/floating-ui) |
| `@floating-ui/react-dom` | `2.1.9` | MIT | [LICENSE](public/third-party-licenses/npm/floating-ui-react-dom@2.1.9/LICENSE)<br>Copyright (c) 2021-present Floating UI contributors | [npm](https://www.npmjs.com/package/@floating-ui/react-dom/v/2.1.9) · [репозиторий](https://github.com/floating-ui/floating-ui) |
| `@floating-ui/utils` | `0.2.12` | MIT | [LICENSE](public/third-party-licenses/npm/floating-ui-utils@0.2.12/LICENSE)<br>Copyright (c) 2021-present Floating UI contributors | [npm](https://www.npmjs.com/package/@floating-ui/utils/v/0.2.12) · [репозиторий](https://github.com/floating-ui/floating-ui) |
| `@huggingface/transformers` | `3.8.1` | Apache-2.0 | [LICENSE](public/third-party-licenses/npm/huggingface-transformers@3.8.1/LICENSE)<br>Конкретная строка copyright в LICENSE не найдена. | [npm](https://www.npmjs.com/package/@huggingface/transformers/v/3.8.1) · [репозиторий](https://github.com/huggingface/transformers.js) |
| `@mintplex-labs/piper-tts-web` | `1.0.5` | MIT | **Не найден в установленном пакете; текст и copyright требуют подтверждения.** | [npm](https://www.npmjs.com/package/@mintplex-labs/piper-tts-web/v/1.0.5) · [репозиторий](https://github.com/Mintplex-Labs/piper-tts-web) |
| `@sherpaw/asr` | `0.0.2` | Apache-2.0 | [LICENSE](public/third-party-licenses/npm/sherpaw-asr@0.0.2/LICENSE)<br>Copyright 2025 Makito (раздел License установленного README). | [npm](https://www.npmjs.com/package/@sherpaw/asr/v/0.0.2) · [репозиторий](https://github.com/sumimakito/sherpaw) |
| `class-variance-authority` | `0.7.1` | Apache-2.0 | [LICENSE](public/third-party-licenses/npm/class-variance-authority@0.7.1/LICENSE)<br>Copyright 2022 Joe Bell | [npm](https://www.npmjs.com/package/class-variance-authority/v/0.7.1) · [репозиторий](https://github.com/joe-bell/cva) |
| `clsx` | `2.1.1` | MIT | [license](public/third-party-licenses/npm/clsx@2.1.1/license)<br>Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com) | [npm](https://www.npmjs.com/package/clsx/v/2.1.1) |
| `lucide-react` | `1.31.0` | ISC | [LICENSE](public/third-party-licenses/npm/lucide-react@1.31.0/LICENSE)<br>Copyright (c) 2026 Lucide Icons and Contributors<br>Copyright (c) 2013-present Cole Bemis | [npm](https://www.npmjs.com/package/lucide-react/v/1.31.0) · [репозиторий](https://github.com/lucide-icons/lucide) |
| `onnx-asr-web` | `0.1.3` | MIT | [LICENSE](public/third-party-licenses/npm/onnx-asr-web@0.1.3/LICENSE)<br>Copyright (c) 2026 Alexander Metzger | [npm](https://www.npmjs.com/package/onnx-asr-web/v/0.1.3) · [репозиторий](https://github.com/SanderGi/onnx-asr-web) |
| `onnxruntime-common` | `1.24.3` | MIT | **Не найден в установленном пакете; текст и copyright требуют подтверждения.** | [npm](https://www.npmjs.com/package/onnxruntime-common/v/1.24.3) · [репозиторий](https://github.com/Microsoft/onnxruntime) |
| `onnxruntime-web` | `1.24.3` | MIT | **Не найден в установленном пакете; текст и copyright требуют подтверждения.** | [npm](https://www.npmjs.com/package/onnxruntime-web/v/1.24.3) · [репозиторий](https://github.com/Microsoft/onnxruntime) |
| `onnxruntime-web` | `1.22.0-dev.20250409-89f8206ba4` | MIT | **Не найден в установленном пакете; текст и copyright требуют подтверждения.** | [npm](https://www.npmjs.com/package/onnxruntime-web/v/1.22.0-dev.20250409-89f8206ba4) · [репозиторий](https://github.com/Microsoft/onnxruntime) |
| `react` | `19.2.6` | MIT | [LICENSE](public/third-party-licenses/npm/react@19.2.6/LICENSE)<br>Copyright (c) Meta Platforms, Inc. and affiliates. | [npm](https://www.npmjs.com/package/react/v/19.2.6) · [репозиторий](https://github.com/facebook/react) |
| `react-dom` | `19.2.6` | MIT | [LICENSE](public/third-party-licenses/npm/react-dom@19.2.6/LICENSE)<br>Copyright (c) Meta Platforms, Inc. and affiliates. | [npm](https://www.npmjs.com/package/react-dom/v/19.2.6) · [репозиторий](https://github.com/facebook/react) |
| `scheduler` | `0.27.0` | MIT | [LICENSE](public/third-party-licenses/npm/scheduler@0.27.0/LICENSE)<br>Copyright (c) Meta Platforms, Inc. and affiliates. | [npm](https://www.npmjs.com/package/scheduler/v/0.27.0) · [репозиторий](https://github.com/facebook/react) |
| `tailwind-merge` | `3.6.0` | MIT | [LICENSE.md](public/third-party-licenses/npm/tailwind-merge@3.6.0/LICENSE.md)<br>Copyright (c) 2021 Dany Castillo | [npm](https://www.npmjs.com/package/tailwind-merge/v/3.6.0) · [репозиторий](https://github.com/dcastil/tailwind-merge) |
| `use-sync-external-store` | `1.6.0` | MIT | [LICENSE](public/third-party-licenses/npm/use-sync-external-store@1.6.0/LICENSE)<br>Copyright (c) Meta Platforms, Inc. and affiliates. | [npm](https://www.npmjs.com/package/use-sync-external-store/v/1.6.0) · [репозиторий](https://github.com/facebook/react) |
| `tailwindcss` | `4.2.1` | MIT | [LICENSE](public/third-party-licenses/npm/tailwindcss@4.2.1/LICENSE)<br>Copyright (c) Tailwind Labs, Inc. | [npm](https://www.npmjs.com/package/tailwindcss/v/4.2.1) · [репозиторий](https://github.com/tailwindlabs/tailwindcss) |
| `tw-animate-css` | `1.4.0` | MIT | [LICENSE](public/third-party-licenses/npm/tw-animate-css@1.4.0/LICENSE)<br>Copyright (c) 2025 Wombosvideo | [npm](https://www.npmjs.com/package/tw-animate-css/v/1.4.0) |

`lucide-react` распространяется с составным файлом: ISC для Lucide и отдельный MIT-текст для унаследованных от Feather иконок. Он скопирован полностью, включая список иконок и оба уведомления об авторских правах. `tailwindcss` - devDependency в manifest, но его CSS входит в проверенную сборку; поэтому он включён в таблицу.

## Отсутствующие оригинальные файлы и источники проверки

- **@mintplex-labs/piper-tts-web 1.0.5:** metadata установленного пакета и [карточка версии npm](https://www.npmjs.com/package/%40mintplex-labs/piper-tts-web/v/1.0.5) указывают MIT. В установленном пакете и на [главной ветке репозитория](https://github.com/Mintplex-Labs/piper-tts-web) отдельный LICENSE не найден; точный текст и copyright пакета не восстановлены. README называет проект форком `@diffusion-studio/vits-web`; состав и права отдельных встроенных компонентов требуют проверки.
- **onnxruntime-web 1.24.3 и onnxruntime-common 1.24.3:** метаданные установленных пакетов указывают MIT; отдельных LICENSE/NOTICE в них не найдено. [Манифест upstream web на теге v1.24.3](https://github.com/microsoft/onnxruntime/blob/v1.24.3/js/web/package.json) связывает источник с релизом; получить и сверить его оригинальные LICENSE и применимые third-party notices ещё необходимо. Файл LICENSE тега через доступное средство проверки не открылся.
- **onnxruntime-web 1.22.0-dev.20250409-89f8206ba4:** метаданные указывают MIT, оригинальный файл в пакете отсутствует. [LICENSE в upstream-коммите `89f8206ba4`](https://github.com/microsoft/onnxruntime/blob/89f8206ba4f1c22c39e0297fb55272e8ce8cd7d0/LICENSE) указывает MIT и copyright Microsoft Corporation. Полный оригинальный файл не скопирован из сети в этот набор, его необходимо получить и сверить с точной сборкой.

## WASM и компоненты с неустановленными вложенными уведомлениями

- `@sherpaw/asr@0.0.2`: собираются JS и `dist/prebuilt/asr.wasm`; локальный пакет сообщает Apache-2.0 для обёртки, но состав и лицензии компонентов конкретного бинарного WASM отдельно не проверены.
- `onnxruntime-web@1.24.3`: в тестовой сборке исходниками двух бинарников были `dist/ort-wasm-simd-threaded.wasm` и `dist/ort-wasm-simd-threaded.jsep.wasm`. Для `onnxruntime-web@1.22.0-dev.20250409-89f8206ba4` - свой `dist/ort-wasm-simd-threaded.jsep.wasm`. Состав бинарников и применимые third-party notices не подтверждены.
- `@mintplex-labs/piper-tts-web@1.0.5`: пакет содержит предварительно собранный `dist/piper-o91UDS6e.js` и указывает внешние phonemizer WASM/data. Конкретный runtime URL в установленном `dist/piper-tts-web.js`: `@diffusionstudio/piper-wasm@1.0.0`; этот удалённо загружаемый пакет и его вложенные компоненты не включены в список 23 локально собранных npm-пакетов, их точный состав и лицензии не подтверждены.
- `public/speech/vosk.js` и вложенные бинарные компоненты: общий состав и все условия третьих сторон не установлены. В самом файле содержатся сторонние встроенные уведомления, в том числе JavaScript MD5 и BSD; файл необходимо сохранять вместе с его notices.

## Шрифты и Vosk

- **Andika**, SIL Open Font License 1.1: [исходный текст с copyright SIL International](public/third-party-licenses/fonts/andika/Andika-OFL.txt). Копия исходного `app/fonts/Andika-OFL.txt`.
- **Nunito**, SIL Open Font License 1.1: [исходный текст с copyright Nunito Project Authors](public/third-party-licenses/fonts/nunito/Nunito-OFL.txt). Копия исходного `app/fonts/Nunito-OFL.txt`.
- **Vosk-Browser 0.0.8** и модель **small-ru-0.22**: [исходное уведомление](public/third-party-licenses/vosk/NOTICE.txt), [лицензия Vosk-Browser](public/third-party-licenses/vosk/LICENSE-vosk-browser.txt), [лицензия модели](public/third-party-licenses/vosk/LICENSE-model.txt). Эти файлы также присутствуют в `public/speech/`; исходное уведомление сообщает о перепаковке и разделении модели.

Удалённо загружаемые голоса Piper и модели GigaAM, Zipformer и Whisper не подтверждены данным npm-инвентарём как файлы сборки; их условия и атрибуции перечислены с оговорками в [реестре моделей и медиа](docs/MODEL-LICENSES.md). Файлы `lib/entry08/vendor` и `lib/curriculum/vendor` находятся в сборке, но их происхождение и права не устанавливаются по одному названию каталога; документы исходной поставки требуют отдельной проверки.

## Источники и воспроизводимость

Состав определён по установленным пакетам, lockfile и модульному графу локальной сборки. Оригиналы npm LICENSE скопированы побайтно из установленных пакетов; шрифтовые и Vosk-документы - из указанных путей проекта. Данный каталог не подключён к конфигурации сборки автоматически.
