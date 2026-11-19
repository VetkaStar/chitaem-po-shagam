# Модели речи и медиа: происхождение и условия

Лицензии программных библиотек не равны лицензиям моделей и обучающих данных. Фактические версии удалённо загружаемых моделей и их лицензии следует повторно проверять при обновлениях. Для частей ниже, помеченных как неустановленные, настоящий документ не выдаёт разрешение на использование.

## Распознавание речи

| Компонент | Источник и сведения |
| --- | --- |
| Vosk small RU 0.22 | Модель поставляется частями в `public/speech/`. [Каталог Vosk](https://alphacephei.com/vosk/models) указывает Apache-2.0; [локальное уведомление](../public/speech/NOTICE.txt) содержит сведения о модели, библиотеке и перепаковке. |
| GigaAM v3 ONNX | [Конвертация istupakov/gigaam-v3-onnx](https://huggingface.co/istupakov/gigaam-v3-onnx) и [исходная модель GigaAM-v3](https://huggingface.co/ai-sage/GigaAM-v3) указывают MIT. Файлы загружаются извне; конкретную ревизию необходимо фиксировать отдельно. |
| Zipformer | [Конвертация INT8](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-small-ru-vosk-int8-2025-08-16) ссылается на [модель Alpha Cephei](https://huggingface.co/alphacep/vosk-model-small-streaming-ru), для которой указана Apache-2.0. Явная лицензия конкретной конвертации и её соответствие источнику требуют подтверждения. |
| Whisper Base ONNX | [onnx-community/whisper-base](https://huggingface.co/onnx-community/whisper-base) указывает Apache-2.0 и исходную модель OpenAI. Фактическую загруженную ревизию необходимо подтвердить. |

## Голоса Piper

Piper загружает отдельные голоса Ирина, Руслан, Денис и Дмитрий из зеркала `diffusionstudio/piper-voices`. Лицензия JavaScript-библиотеки Piper не определяет автоматически права на голосовые модели.

- В исторической [карточке Irina](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/ru/ru_RU/irina/medium/MODEL_CARD) лицензия исходного набора указана как `Unknown`.
- В исторической [карточке Ruslan](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/ru/ru_RU/ruslan/medium/MODEL_CARD) для набора указана CC BY-NC-SA 4.0.
- Исторические карточки [Denis](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/ru/ru_RU/denis/medium/MODEL_CARD) и [Dmitri](https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/ru/ru_RU/dmitri/medium/MODEL_CARD) указывают CC0 для набора и базу Lessac. Исходные материалы [Lessac/Blizzard 2013](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) имеют исследовательские условия; применимость этих условий к конкретным весам не установлена.

Эти карточки относятся к исторической версии исходного репозитория, а не подтверждают точную ревизию загружаемого зеркала или сохранённых пользователями файлов. Условия использования весов, в том числе коммерческого, требуют отдельного подтверждения.

Фонемизатор Piper загружается как внешний WASM-пакет; его сборка может включать eSpeak NG с собственными условиями. Состав конкретного бинарного файла и соответствующие уведомления требуют проверки. Не следует выводить лицензию всего приложения только из этого факта.

## Шрифты и изображения

Шрифты Andika и Nunito распространяются по SIL Open Font License 1.1; тексты и уведомления авторов сохранены в `public/third-party-licenses/fonts/` и перечислены в [реестре сторонних компонентов](../THIRD-PARTY-NOTICES.md).

Иллюстрации проекта созданы для проекта, согласно сообщению владельца. Манифесты импорта подтверждают файлы и их контрольные суммы; они не подтверждают права на возможные сторонние исходные изображения и референсы. Лицензия Vetka_Star применяется к её собственным правам с учётом таких прав третьих лиц.
