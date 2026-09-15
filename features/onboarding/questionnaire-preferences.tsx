import type { Questionnaire } from '../../lib/curriculum/types';
import { AccessFields, BooleanQuestion } from './AccessSetup';
import type { QuestionnaireFieldsProps } from './questionnaire-reading-fields';
// Fixed categories from onboarding-0.7.3 §2; all eight tags exist in curriculum 0.7.0.
const interests = [
  ['technology', 'Техника'],
  ['retro_pc', 'Старые компьютеры'],
  ['phones', 'Телефоны'],
  ['consoles', 'Консоли'],
  ['videogames', 'Игры'],
  ['sandbox_building', 'Постройки'],
  ['animals', 'Животные'],
  ['everyday', 'Обычная жизнь'],
] as const;

export function PreferenceFields({
  draft,
  change,
  disabled,
  onBlur,
}: QuestionnaireFieldsProps & { onBlur: () => void }) {
  const selectedPairs = draft.letterPairs ?? [];
  return (
    <>
      {' '}
      <fieldset className="curriculum-answer-form" disabled={disabled}>
        <legend>Что важно сейчас</legend>
        <label className="curriculum-answer-form">
          Что важнее сейчас?
          <select
            value={draft.goal ?? ''}
            onChange={(e) => change({ goal: e.target.value || null })}
          >
            <option value="">Не знаю</option>
            <option value="blend">Соединять части</option>
            <option value="words">Читать слова</option>
            <option value="sentences">Читать предложения</option>
            <option value="meaning">Понимать прочитанное</option>
            <option value="texts">Читать тексты</option>
            <option value="access">Заниматься удобнее</option>
          </select>
        </label>
        {draft.goal === 'meaning' && (
          <label className="curriculum-answer-form">
            Когда читает другой человек, понимать легче?
            <select
              value={draft.listeningEasier ?? ''}
              onChange={(e) =>
                change({
                  listeningEasier: (e.target.value ||
                    null) as Questionnaire['listeningEasier'],
                })
              }
            >
              <option value="">Не знаю</option>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
              <option value="sometimes">Иногда</option>
            </select>
          </label>
        )}
        <fieldset className="curriculum-answer-form">
          <legend>Какие знаки путаются?</legend>
          {[
            ['LP', 'Л / П'],
            ['MS', 'М / Ш'],
            ['OTHER', 'Другая пара'],
          ].map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selectedPairs.includes(id)}
                onChange={(e) =>
                  change({
                    letterPairs: e.target.checked
                      ? [...selectedPairs.filter((pair) => pair !== 'NONE'), id]
                      : selectedPairs.filter((pair) => pair !== id),
                  })
                }
              />{' '}
              {label}
            </label>
          ))}
          <div className="curriculum-actions">
            <button
              type="button"
              aria-pressed={selectedPairs.length === 0}
              onClick={() => change({ letterPairs: [] })}
            >
              Не знаю
            </button>
            <button
              type="button"
              aria-pressed={selectedPairs.includes('NONE')}
              onClick={() => change({ letterPairs: ['NONE'] })}
            >
              Не замечали
            </button>
          </div>
          {selectedPairs.includes('OTHER') && (
            <label className="curriculum-answer-form">
              Какая другая пара?
              <input
                className="curriculum-text-input"
                value={draft.otherLetterPair ?? ''}
                onChange={(e) =>
                  change({ otherLetterPair: e.target.value }, false)
                }
                onBlur={onBlur}
              />
            </label>
          )}
        </fieldset>
      </fieldset>
      <fieldset className="curriculum-answer-form" disabled={disabled}>
        <legend>Помощник и доступность</legend>
        <BooleanQuestion
          label="Рядом есть помощник, который может наблюдать выполнение и подтвердить чтение?"
          value={draft.companionAvailable}
          onChange={(companionAvailable) => change({ companionAvailable })}
        />
        <AccessFields value={draft} onChange={change} />
      </fieldset>
      <fieldset className="curriculum-answer-form" disabled={disabled}>
        <legend>Темы, которые интересны</legend>
        {interests.map(([tag, label]) => (
          <label key={tag}>
            <input
              type="checkbox"
              checked={draft.interests.includes(tag)}
              onChange={(e) =>
                change({
                  interests: e.target.checked
                    ? [...draft.interests, tag]
                    : draft.interests.filter((item) => item !== tag),
                })
              }
            />{' '}
            {label}
          </label>
        ))}
        <label className="curriculum-answer-form">
          Что ещё интересно?
          <input
            className="curriculum-text-input"
            value={draft.interestDetails ?? ''}
            onChange={(e) => change({ interestDetails: e.target.value }, false)}
            onBlur={onBlur}
          />
        </label>
        <p>
          Темы используются только среди готовых материалов. Проверочные задания
          от интересов не меняются.
        </p>
      </fieldset>
    </>
  );
}
