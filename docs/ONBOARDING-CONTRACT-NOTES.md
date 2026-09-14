# Контракт первого входа: заметки для этапа 1

Подготовлено независимым агентом первого входа по локальному onboarding-0.7.3. Это предложение владельцу общих контрактов, а не изменение поставляемого Profile v2. UI и общие файлы не изменялись. Источники: docs/DEVELOPMENT-PLAN.md; materials/curriculum-supply/onboarding-0.7.3/01_Спецификация.md, разделы 2–4, 7–10, 13, 15; entry_planner.mjs; entry_registry.json.

## Разделение свободного выбора и входной практики

«Настроить позже» сохраняет выбор свободных тренажёров и состояние отложенной настройки, затем сразу открывает существующий каталог. Не вызывает normaliseAnswers, switchProgram, beginVisit или resolvePlacement. Отсутствие маршрута допустимо. Не создаются первая группа, стартовая карточка, P1/P2 или входное подтверждение. Уже существующие ответы, результаты и позиции программ сохраняются.

provisional_free — другой результат: определённая после анкеты практика из трёх literal ID с причиной, выбранным методом и pendingCheckpoint. Это не синоним отказа от настройки. Режим приложения и источник дорожки должны храниться отдельно от launch.kind входного планировщика.

## Предлагаемые типы анкеты

Имена русских вариантов, не зафиксированные как literal в исходном JS, ниже являются новыми значениями адаптера платформы. Их надо зафиксировать один раз в общих типах. null означает отсутствие ответа; false означает явное «нет». Не заменять исходные ответы нормализованным результатом: normaliseAnswers преобразует неизвестного помощника в false и неизвестный метод в P1.

```ts
type ProgramId = 'method_syllable_first' | 'method_word_first';
type ReadLevel = 'letters' | 'syllables' | 'short_words' | 'multi_part' | 'sentences' | 'texts';
type UnknownBoolean = boolean | null;
type EntryGroupId = 'CV' | 'VC' | 'CVC' | 'CV2' | 'LEN3' | 'MEDIAL' | 'INITIAL'
  | 'SUBJECT' | 'OBJECT' | 'LOCATION' | 'LOCATE2' | 'FACTS3' | 'SEQ2' | 'SEQ3'
  | 'CAUSE2' | 'CAUSE3' | 'STORY5' | 'TRANSFER' | 'ANCHOR' | 'BOUNDARY' | 'FADE'
  | 'NEWCV2' | 'READ_MEANING' | 'LP_SIGN' | 'LP_CV' | 'LP_WORD' | 'MS_SIGN' | 'MS_WORD';
type InterestTag = 'technology' | 'retro_pc' | 'phones' | 'consoles' | 'videogames'
  | 'sandbox_building' | 'animals' | 'everyday';
interface Questionnaire {
  respondent: 'learner' | 'adult' | 'together' | null;
  ageBand: 'under_6' | '6_7' | '8_12' | '13_17' | '18_plus' | null;
  presentation: 'school' | 'neutral' | null;
  reads: ReadLevel[] | null;
  blendingDifficulty: 'often' | 'sometimes' | 'never' | null;
  onlyMemorisedWords: UnknownBoolean;
  goal: 'blend' | 'words' | 'sentences' | 'meaning' | 'texts' | 'comfort' | null;
  letterPairs: ('LP' | 'MS')[];
  otherLetterPair: string | null;
  letterPairReport: 'specified' | 'not_noticed' | 'unknown';
  companionAvailable: UnknownBoolean;
  responseMode: 'button' | 'keyboard' | 'voice_with_companion' | 'companion_selects' | null;
  instructionsReadable: UnknownBoolean;
  audioUsable: UnknownBoolean;
  visualTextUsable: boolean | 'needs_setup' | null;
  canUseButtons: UnknownBoolean;
  canUseKeyboard: UnknownBoolean;
  companionCanSelect: UnknownBoolean;
  budget: 3 | 5 | 7 | null;
  motionAllowed: boolean; // Начальное значение false.
  instructionAudio: 'on_request' | 'always' | 'off';
  interests: InterestTag[];
  interestDetails: string | null;
  listeningEasier: boolean | 'sometimes' | null;
  program: ProgramId | 'show_methods' | null;
}
interface AccessState {
  status: 'unconfirmed' | 'access_needed' | 'testing' | 'access_preconfirmed' | 'confirmed';
  selectionMode: 'button' | 'keyboard' | 'companion_selects' | null;
  instructionChannel: 'text' | 'audio' | 'companion' | null;
  attemptCount: 0 | 1 | 2;
  demonstrationShown: boolean;
  lastSelection: 'circle' | 'square' | null;
}
```

Для планировщика адаптер передаёт known reads или [], LP/MS, actual ProgramId либо отсутствие предпочтения, interestTags (не interests), false вместо needs_setup только в вычисленном входе accessDecision. Дефолт бюджета 5 задаёт исходный normaliseAnswers. show_methods открывает добровольную демонстрацию, но не является programId. Самоотчёт unknown не конкурирует с отмеченными reads. instructionAudio действует только при audioUsable=true. needs_setup требует настройки до оценивания, хотя исходный accessDecision понимает только false.

## Оболочка и восстановление

```ts
interface OnboardingEnvelope<Observation, Confirmation, Placement, Reason> {
  schemaVersion: 1; // Версия оболочки платформы; отдельна от спецификации.
  specVersion: 'onboarding-0.7.3';
  curriculumSha256: string; // Точное равенство проверенному манифесту.
  setupStatus: 'not_started' | 'deferred' | 'in_progress' | 'completed';
  screen: 'questionnaire' | 'access_setup' | 'entry_checkpoint' | 'placement_report';
  questionnaireStep: string | null; // Только ключ известного поля/экрана.
  questionnaire: Questionnaire;
  access: AccessState;
  checkpointId: string | null;
  checkpointPurpose: 'initial' | 'prerequisite' | 'side' | null;
  currentCheckpointGroup: EntryGroupId | null;
  rootGoalGroup: EntryGroupId | null;
  returnToNodeId: string | null;
  deferredGroups: EntryGroupId[];
  sideQueue: EntryGroupId[];
  observations: Observation[];
  confirmedEntrySkills: Confirmation[];
  probeState: Partial<Record<EntryGroupId, {
    usedItemIds: string[];
    unavailableLetters: string[];
    unavailableCapabilities: string[];
    familiarTargets: string[];
  }>>;
  launch: Placement | null;
  reasonTrace: Reason[];
}
```

Параметры Observation/Confirmation/Placement/Reason должны стать строгими типами общего владельца по реальным исходным результатам; не оставлять unknown/any как финальную валидацию JSON. Observation хранит checkpointId, instanceId, itemId (taskId в тексте спецификации означает itemId ядра), contentHash, groupId, sessionId, mode, raw Submission, helpLevel, readingTargetAudioPlayed, результат и причину, источник подтверждения и metadata до предъявления. Metadata: purpose=entry_probe, groupId, instanceId, independentAccess, promptFree, novelTargetBeforeShow, freshPassageBeforeShow, familiarBeforeShow, onlyMemorised, companionObserved. Источник этих полей — контроллер, а не ответ ученика.

История observations либо индексируется по checkpointId, либо хранится раздельно по checkpoints. groupStatus/confirmEligibleGroups получает только наблюдения текущего checkpoint. Перепроверка создаёт новый checkpoint; архив сохраняется. Confirmation содержит skillId, checkpointId, groupId и два instanceId основания, статус confirmed_entry; не mastered.

Оболочка атомарно сохраняется с Profile v2, общей revision платформы и планом. Profile восстанавливается целиком: activeInstance с partial и порядком вариантов/стадиями раскрытия, currentVisit, exposures/events, receipts и обе programs с suspendedInstance/suspendedPlan. Не хранить вторую изменяемую копию этих данных в onboarding. Нельзя восстановить только stepIndex и заново выбрать карточку. Ключ награды — завершённый instanceId, не текущий экран.

launch.kind имеет ровно девять результатов поставки: formal_route, entry_checkpoint_needed, entry_checkpoint_unavailable, provisional_free, side_support, access_setup, engine_gate, engine_action, scope_complete. startProgramId/startNodeId/startEpisodeId/firstStepId заполняются только для formal_route; для остальных у оболочки null. Для side_support сохраняются sourceNodeId/sourceEpisodeId/returnToOrigin; для practice — orderedTaskIds/mode/pendingCheckpoint. Исходная рекомендация и фактический старт различаются. profileToPersist надо извлекать из результата и сохранять в ту же транзакцию; если результат сохранён целиком, валидировать отсутствие рассогласования с основным Profile.

## Runtime проверки и тесты для владельца

1. Проверять объект, все enum, массивы, nullable значения, конечные целые revision/budget, спецификацию и SHA. Неизвестную версию не преобразовывать молча. Сохранить исходный импорт при отказе; не затирать текущие данные.
2. Проверять каждый groupId по собственным ключам registry.groups. FACT3 — ошибка UNKNOWN_ENTRY_GROUP, не FACTS3 и не конец. Только явно полученный successNextGroup=null означает scope_complete; отсутствие поля или undefined не эквивалентны.
3. Проверять связи itemId/contentHash/groupId, node/episode/step/program по снимку, instanceId и checkpointId; optionId/questionId/tokenId — по фактическому экземпляру. reads не позволяет произвольные строки. Другие пары букв не порождают skillId.
4. access_preconfirmed устанавливается явным подтверждением привычного доступного ввода; UI_ACCESS не является учебным taskId и не подтверждает чтение. После двух ошибок вернуться в доступность с сохранённой группой. Озвучка инструкции и изменение размера не равны целевой помощи.
5. Предъявление + metadata сохраняются до показа. Помощь сохраняется до раскрытия. partial сохраняет instanceId, сырые ответы по questionId и тот же бюджетный экран. ASR/один звук не дают ReadingProof.
6. Для трёх ветвей с profileToPersist (formal_route/engine_gate/engine_action) сохраняется именно возвращённый профиль до использования плана. Перед расчётом уникальный beginVisit; текущий visit не переименовывать. Изменение revision требует нового плана; конфликт вкладок отклоняет запись.
7. «Позже» → перезагрузка → свободный каталог без программы; добровольное возобновление анкеты сохраняет ответы. Возврат из курса в свободный каталог не удаляет/сдвигает курсор.
8. Минимальные независимые регрессии: нужда в настройке визуального доступа; null/false анкеты; неизвестная группа в импорте; чужой checkpoint не добавляет успех; duplicate instance не добавляет награду; partial восстанавливает порядок; отсутствие помощника не подтверждает skill; две программы сохраняют отдельные позиции.

## Граница работы агента первого входа

На этапе 1 допустимы типизированные формы на фикстурах после утверждения общих интерфейсов. Полный экранный поток относится к этапу 4. Агент не владеет Profile, хранилищем, AppPortal и решающими функциями. UI получает проекцию состояния и dispatch разрешённых команд; не выбирает учебный itemId и не пишет confirmedSkills.
