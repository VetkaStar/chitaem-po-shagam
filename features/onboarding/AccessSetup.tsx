import { useEffect, useRef, useState } from 'react';
import type { Questionnaire } from '../../lib/curriculum/types';

export function BooleanQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <label className="curriculum-answer-form">
      {label}
      <select
        value={value == null ? '' : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : event.target.value === 'true',
          )
        }
      >
        <option value="">Не знаю</option>
        <option value="true">Да</option>
        <option value="false">Нет</option>
      </select>
    </label>
  );
}

/** Shared access questions contain no assessment or curriculum decisions. */
export function AccessFields({
  value,
  onChange,
}: {
  value: Questionnaire;
  onChange: (patch: Partial<Questionnaire>) => void;
}) {
  return (
    <>
      <label className="curriculum-answer-form">
        Как удобнее отвечать?
        <select
          value={value.responseMode ?? ''}
          onChange={(e) => onChange({ responseMode: e.target.value || null })}
        >
          <option value="">Не знаю</option>
          <option value="buttons">Кнопками</option>
          <option value="keyboard">Клавиатурой</option>
          <option value="voice_companion">Голосом с помощником</option>
          <option value="companion_select">Нажимает помощник</option>
        </select>
      </label>
      <BooleanQuestion
        label="Понятен текст инструкции без помощи?"
        value={value.instructionsReadable}
        onChange={(instructionsReadable) => onChange({ instructionsReadable })}
      />
      <BooleanQuestion
        label="Можно пользоваться озвучкой и понимать её?"
        value={value.audioUsable}
        onChange={(audioUsable) =>
          onChange({
            audioUsable,
            ...(audioUsable === true
              ? {}
              : { instructionAudio: 'off' as const }),
          })
        }
      />
      <BooleanQuestion
        label="Буквы видны и различимы?"
        value={value.visualTextUsable}
        onChange={(visualTextUsable) => onChange({ visualTextUsable })}
      />
      <BooleanQuestion
        label="Удобно нажимать кнопки?"
        value={value.canUseButtons}
        onChange={(canUseButtons) => onChange({ canUseButtons })}
      />
      <BooleanQuestion
        label="Удобно пользоваться клавиатурой?"
        value={value.canUseKeyboard}
        onChange={(canUseKeyboard) => onChange({ canUseKeyboard })}
      />
      <BooleanQuestion
        label="Помощник может нажимать выбранный ответ?"
        value={value.companionCanSelect}
        onChange={(companionCanSelect) => onChange({ companionCanSelect })}
      />
      <label className="curriculum-answer-form">
        Движение
        <select
          value={value.motionAllowed === true ? 'on' : 'off'}
          onChange={(e) => onChange({ motionAllowed: e.target.value === 'on' })}
        >
          <option value="off">Выключено</option>
          <option value="on">Включено</option>
        </select>
      </label>
      <label className="curriculum-answer-form">
        Озвучка инструкции
        <select
          value={
            value.audioUsable === true
              ? (value.instructionAudio ?? 'button')
              : 'off'
          }
          onChange={(e) =>
            onChange({
              instructionAudio: e.target
                .value as Questionnaire['instructionAudio'],
            })
          }
        >
          <option value="off">Без звука</option>
          <option value="button" disabled={value.audioUsable !== true}>
            По кнопке
          </option>
          <option value="always" disabled={value.audioUsable !== true}>
            Всегда
          </option>
        </select>
      </label>
      {value.audioUsable !== true && (
        <p>
          Озвучку можно включить после подтверждения, что ею удобно
          пользоваться.
        </p>
      )}
    </>
  );
}

export default function AccessSetup({
  value,
  attempts,
  passed,
  busy,
  onSave,
  onAnswer,
  onContinue,
}: {
  value: Questionnaire;
  attempts: number;
  passed: boolean;
  busy: boolean;
  onSave: (q: Questionnaire) => Promise<void>;
  onAnswer: (shape: 'circle' | 'square') => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState(value),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const locked = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  useEffect(() => setDraft(value), [value]);
  const save = async () => {
    if (busy || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      await onSave(draft);
    } catch {
      setError('Не удалось сохранить настройки. Попробуй ещё раз.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  };
  return (
    <section
      className="curriculum-step"
      aria-label="Настройка доступа"
      aria-busy={busy || saving}
    >
      <h2>Проверим, удобно ли пользоваться кнопками</h2>
      <p>
        Это проверка управления, а не чтения. Кнопки также можно выбрать
        клавишей Tab и нажать Enter.
      </p>
      {passed ? (
        <>
          <p role="status">Получилось выбрать круг.</p>
          <button
            type="button"
            disabled={busy || saving || dirty}
            onClick={onContinue}
          >
            Продолжить
          </button>
        </>
      ) : attempts >= 2 ? (
        <p role="status">
          Пока настроим удобный способ выбора. Проверь настройки ниже, сохрани
          их и попробуй ещё раз. Чтение не оценивается.
        </p>
      ) : (
        <>
          <h3>Выбери круг</h3>
          {attempts === 1 && (
            <div className="curriculum-material" role="status">
              <p>●</p>
              <p>
                Это круг. Выбери такую же фигуру. Можно воспользоваться
                клавиатурой или попросить помощника нажать выбранный ответ.
              </p>
            </div>
          )}
          <div className="curriculum-actions">
            <button
              type="button"
              className="curriculum-character"
              aria-label="Круг"
              disabled={busy || saving || dirty}
              onClick={() => onAnswer('circle')}
            >
              ●
            </button>
            <button
              type="button"
              className="curriculum-character"
              aria-label="Квадрат"
              disabled={busy || saving || dirty}
              onClick={() => onAnswer('square')}
            >
              ■
            </button>
          </div>
        </>
      )}
      {dirty && (
        <p role="status">
          Сначала сохрани изменённые настройки, затем повтори выбор круга.
        </p>
      )}
      <form
        className="curriculum-answer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset className="curriculum-answer-form" disabled={busy || saving}>
          <legend>Удобный способ работы</legend>
          <AccessFields
            value={draft}
            onChange={(patch) =>
              setDraft((current) => ({ ...current, ...patch }))
            }
          />
        </fieldset>
        {error && (
          <p role="alert" className="curriculum-save-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || saving}>
          Сохранить настройки и повторить
        </button>
      </form>
    </section>
  );
}
