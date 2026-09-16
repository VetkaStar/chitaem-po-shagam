# Базовая проверка onboarding-0.8.1

Проверено локально 17.09.2026. Рабочий commit при аудите: `588f9dcb1914cc2c1b23d210019d278366c58b6b`.

## Комплект и проверки

- Корень: `materials/onboarding-0.8.1/extracted/onboarding-0.8.1`.
- `release_manifest.json`: все **65 файлов** совпадают по SHA-256 и числу байтов; пропусков и расхождений нет. Повторная сверка после тестов также без расхождений.
- UI/controller: **0.8.1**; банк: **0.8.0** (так задумано поставкой); curriculum: **0.7.0**.
- Банк: **46 карточек**, **12 групп**; 28 `read`, 16 `passage`, 2 `listen`.
- SHA-256 исходного curriculum, указанная банком: `03c8a7b0d4af5c42d63ff7cb732c1489a04d89a5197f78b2c4c58c72d6440745`.
- `node tests/entry.test.mjs`: **57/57 PASS**.
- `node tests/review-regression.test.mjs`: **39/39 PASS**.
- Итого повторно выполнено **96 проверок, 0 ошибок**. Node: `./.local/node/bin/node.exe`.
- Сценарии Python DOM в этом аудите **не запускались**: поставка жёстко задаёт Linux Chromium `/usr/bin/chromium`. Заявленные поставщиком 27 DOM PASS не выдаются за локальный прогон. Сами supplied node-тесты используют управляемые медиа, а не физический микрофон.

## Контракт подключения

Поставка содержит `.mjs`, а не TypeScript-типы. Хосту нужен собственный типизированный пограничный модуль и один владелец записи.

| Группа | API | Обязанность хоста |
| --- | --- | --- |
| Анкета | `QUESTIONNAIRE`, `questionnaireFor`, `settings` | Подставить известные значения; ребёнку не показывать взрослые вопросы |
| Состояние | `createEntry`, `upgradeEntry`, `updateInputMode`, `accessReady` | Сохранять возвращённое состояние; не обнулять попытки и бюджет |
| Показ | `nextScreen`, `openCard`, `learnerView` | План содержит revision; сохранить открытие до показа; UI получает learnerView без ключей |
| Звук | `requestAudio`, `finishAudio`, `cancelAudio` | `requestAudio` возвращает `{state,effect}`; persist до speak; передавать instanceId/audioId/scope, не запускать из effect |
| Голос | `startCapture`, `submitSpeech`, `cancelCapture`, `speechIssue` | Capture ID и instance ID; только окончательный ответ; не передавать целевой ответ в грамматику ASR |
| Ответ | `submitChoice`, `submitCompanion`, `showHint`, `skip`, `difficulty`, `next` | Не смешивать чтение, понимание, помощь, отказ устройства и пропуск |
| Пауза | `pause`, `resume`, `finishNow` | Остановить звук/микрофон; открытый экземпляр не резервировать повторно |
| Дорожка | `report`, `chooseLessonEpisode`, `learningPlan` | Только существующие узлы/эпизоды; отдельный курсор обучения, без mastery |
| Совместимость | `historyFromProfile`, `mergeEntry`, `prepareFirstLesson` | Перенести семантику в основной контроллер, не подключать второй writer |

Основной state хранит `version/id/revision/config`, `active`, `observations/receipts/used/prompts/sourceExposures`, `visit/total/totalBudget`, `gap/gapHistory`, `readingGroup`, `paused/finished/accessReady/voiceAvailable/voiceOptIn`, историю и trace. Active содержит `cardId/instanceId`, фазу `read/listen/listening/question/feedback`, чтение, помощь, played, retries, captureId/audio/speechIssue. `learnerView` скрывает варианты до фазы question и ключи всегда.

## Существенные границы и риски

1. `v073-adapter.mjs` импортирует **reference_v073/source/engine.mjs**. Прямое подключение к React создало бы второй механизм изменения legacy-профиля. Переносить в существующий атомарный контроллер; `entry08`/`personalPath08` не заменяют attempts/reviewQueue/confirmedSkills.
2. `mergeEntry` отклоняет меньшую revision того же входа; равную делает идемпотентной. Историю показов/подсказок синхронизирует по отдельным счётчикам. Любая новая интеграция обязана сохранять эти гарантии.
3. `prepareFirstLesson` сначала возвращает `resume_existing`, если есть activeInstance. Иначе формирует курсор; это **не** запуск и оценка полноценного упражнения.
4. `learningPlan` явно возвращает `previewOnly:true`, `grants:[]`, `formalChecksUnchanged:true`. Кадры содержат staffMetadata и не являются безопасной общей проекцией для ребёнка. Полный интерактивный урок с реальным ответом реализует основной исполнитель.
5. Возраст under8/unknown: до 4 единиц всего, 3 за подход; старше: 6 всего, 5 за подход. Passage резервирует 2 единицы сразу. Повтор аудио и восстановление не резервируют новые единицы.
6. Два разных автоматических самостоятельных наблюдения в двух подходах → предложение следующей цели: это требование документа интеграции, **не реализованное самим preview-plan** правило mastery.
7. Только `companion === true` или `yes` допускает подтверждение взрослым; `sometimes` не равно присутствию. ASR остаётся `placement_estimate`, не companion/mastered.
8. `finishAudio` ради совместимости допускает отсутствие audioId; хост всегда обязан передавать его, иначе защита от старого callback слабее. При отмене сначала переход состояния, затем остановка сервисов; отменённый Promise должен завершаться.
9. `upgradeEntry` принимает только 0.8.0/0.8.1; миграцию старой анкеты 0.7.3 и резервную копию профиля должен выполнить хост отдельно.
10. Пользователь ранее разрешил «Настроить позже» с немедленным свободным входом в тренажёры; новый вход не делает дорожку обязательной.

Источник требований: `1-source.md`, `2-source.md`, `4-source.md`; исходники и тесты указанного комплекта. Документ описывает базовый аудит поставки, не приёмку реализованного приложения и не проверку реальной детской речи.
