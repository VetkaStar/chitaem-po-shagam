import { useEffect, useRef, useState } from 'react';
import type { Questionnaire } from '../../lib/curriculum/types';
import { ReadingFields } from './questionnaire-reading-fields';
import { PreferenceFields } from './questionnaire-preferences';

function defaults(value: Questionnaire): Questionnaire {
  return {
    presentation: null,
    onlyMemorisedWords: null,
    goal: null,
    letterPairs: [],
    otherLetterPair: '',
    responseMode: null,
    instructionsReadable: null,
    audioUsable: null,
    visualTextUsable: null,
    canUseButtons: null,
    canUseKeyboard: null,
    companionCanSelect: null,
    motionAllowed: false,
    instructionAudio: value.audioUsable === true ? 'button' : 'off',
    interestDetails: '',
    listeningEasier: null,
    ...value,
  };
}

export default function QuestionnaireForm({
  value,
  busy,
  onSave,
  onContinue,
  onDemonstrate,
}: {
  value: Questionnaire;
  busy: boolean;
  onSave: (q: Questionnaire) => Promise<void>;
  onContinue: () => void;
  onDemonstrate: () => void;
}) {
  const [draft, setDraft] = useState(() => defaults(value)),
    [pending, setPending] = useState(false),
    [moving, setMoving] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(draft),
    saves = useRef(0),
    leaving = useRef(false);
  useEffect(() => {
    if (!saves.current && !leaving.current) {
      latest.current = defaults(value);
      setDraft(latest.current);
    }
  }, [value]);
  async function persist(next: Questionnaire) {
    saves.current++;
    setPending(true);
    setError('');
    try {
      await onSave(next);
      return true;
    } catch {
      setError('Не удалось сохранить ответы. Попробуй ещё раз.');
      return false;
    } finally {
      saves.current--;
      setPending(saves.current > 0);
    }
  }
  function change(patch: Partial<Questionnaire>, save = true) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    if (save) void persist(next);
  }
  async function proceed(action: () => void) {
    if (busy || leaving.current) return;
    leaving.current = true;
    setMoving(true);
    try {
      if (await persist(latest.current)) action();
    } finally {
      leaving.current = false;
      setMoving(false);
    }
  }
  return (
    <form
      className="curriculum-step"
      aria-label="Настройка дорожки"
      aria-busy={busy || pending || moving}
      onSubmit={(event) => {
        event.preventDefault();
        void proceed(onContinue);
      }}
    >
      <h2>Настроим удобное начало</h2>
      <p>
        Можно ответить «Не знаю». Эти ответы помогают выбрать начало и удобный
        способ работы, но не подтверждают навыки.
      </p>
      <ReadingFields draft={draft} change={change} disabled={busy || moving} />
      <PreferenceFields
        draft={draft}
        change={change}
        disabled={busy || moving}
        onBlur={() => void persist(latest.current)}
      />
      <fieldset className="curriculum-answer-form" disabled={busy || moving}>
        <legend>Как начнём</legend>
        <label className="curriculum-answer-form">
          Сколько действий попробовать за занятие?
          <select
            value={draft.budget ?? ''}
            onChange={(e) =>
              change({
                budget: (e.target.value
                  ? Number(e.target.value)
                  : null) as Questionnaire['budget'],
              })
            }
          >
            <option value="">Не знаю — начнём с 5</option>
            <option value="3">3 действия</option>
            <option value="5">5 действий</option>
            <option value="7">7 действий</option>
          </select>
        </label>
        <label className="curriculum-answer-form">
          Какой способ хочешь попробовать?
          <select
            value={draft.program ?? ''}
            onChange={(e) => change({ program: e.target.value || null })}
          >
            <option value="">Пока не знаю</option>
            <option value="method_syllable_first">Сначала части</option>
            <option value="method_word_first">Сначала знакомое целое</option>
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => void proceed(onDemonstrate)}
        >
          Показать способы
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="curriculum-save-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || pending || moving}>
        Продолжить
      </button>
    </form>
  );
}
