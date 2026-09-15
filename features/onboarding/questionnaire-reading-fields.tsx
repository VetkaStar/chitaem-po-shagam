import type { Questionnaire } from '../../lib/curriculum/types';
import { BooleanQuestion } from './AccessSetup';
export interface QuestionnaireFieldsProps {
  draft: Questionnaire;
  change: (patch: Partial<Questionnaire>, save?: boolean) => void;
  disabled: boolean;
}
const readingOptions: {
  value: NonNullable<Questionnaire['reads']>[number];
  label: string;
}[] = [
  { value: 'letters', label: 'Буквы' },
  { value: 'syllables', label: 'Слоги' },
  { value: 'short_words', label: 'Короткие слова' },
  { value: 'multi_part', label: 'Слова из нескольких частей' },
  { value: 'sentences', label: 'Короткие предложения' },
  { value: 'texts', label: 'Небольшие тексты' },
];

export function ReadingFields({
  draft,
  change,
  disabled,
}: QuestionnaireFieldsProps) {
  const complexReading = draft.reads?.some((item) =>
    ['short_words', 'multi_part', 'sentences', 'texts'].includes(item),
  );
  return (
    <>
      {' '}
      <fieldset className="curriculum-answer-form" disabled={disabled}>
        <legend>Кто будет заниматься</legend>
        <label className="curriculum-answer-form">
          Кто отвечает?
          <select
            value={draft.respondent ?? ''}
            onChange={(e) =>
              change({
                respondent: (e.target.value ||
                  null) as Questionnaire['respondent'],
              })
            }
          >
            <option value="">Не знаю</option>
            <option value="learner">Сам ученик</option>
            <option value="adult">Взрослый</option>
            <option value="together">Вместе</option>
          </select>
        </label>
        <label className="curriculum-answer-form">
          Возраст
          <select
            value={draft.ageBand ?? ''}
            onChange={(e) =>
              change({
                ageBand: (e.target.value || null) as Questionnaire['ageBand'],
              })
            }
          >
            <option value="">Не указывать</option>
            <option value="under_6">До 6 лет</option>
            <option value="6_7">6–7 лет</option>
            <option value="8_12">8–12 лет</option>
            <option value="13_17">13–17 лет</option>
            <option value="18_plus">18 лет и старше</option>
          </select>
        </label>
        <label className="curriculum-answer-form">
          Какая подача удобнее?
          <select
            value={draft.presentation ?? ''}
            onChange={(e) =>
              change({
                presentation: (e.target.value ||
                  null) as Questionnaire['presentation'],
              })
            }
          >
            <option value="">Не знаю</option>
            <option value="school">Школьная</option>
            <option value="neutral">Нейтральная</option>
          </select>
        </label>
        <p>
          Основное наполнение рассчитано на школьную подачу 8–12 лет. Выбор
          нейтральной подачи не добавляет отдельный взрослый курс.
        </p>
      </fieldset>
      <fieldset className="curriculum-answer-form" disabled={disabled}>
        <legend>Что уже получается читать?</legend>
        <p>Можно отметить несколько вариантов.</p>
        {readingOptions.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={draft.reads?.includes(option.value) ?? false}
              onChange={(e) => {
                const reads = e.target.checked
                  ? [...(draft.reads ?? []), option.value]
                  : (draft.reads ?? []).filter((item) => item !== option.value);
                change({ reads: reads.length ? reads : null });
              }}
            />{' '}
            {option.label}
          </label>
        ))}
        <button
          type="button"
          aria-pressed={!draft.reads?.length}
          onClick={() => change({ reads: null })}
        >
          Не знаю, что уже получается
        </button>
        {complexReading && (
          <>
            <label className="curriculum-answer-form">
              Части отдельно читаются, а соединять их трудно?
              <select
                value={draft.blendingDifficulty ?? ''}
                onChange={(e) =>
                  change({
                    blendingDifficulty: (e.target.value ||
                      null) as Questionnaire['blendingDifficulty'],
                  })
                }
              >
                <option value="">Не знаю</option>
                <option value="often">Часто</option>
                <option value="sometimes">Иногда</option>
                <option value="never">Нет</option>
              </select>
            </label>
            <BooleanQuestion
              label="Получается узнавать только выученные записи, а новые пока не получается прочитать?"
              value={draft.onlyMemorisedWords}
              onChange={(onlyMemorisedWords) => change({ onlyMemorisedWords })}
            />
          </>
        )}
      </fieldset>
    </>
  );
}
