import { useId, useState } from 'react';
import type { TaskRendererProps } from './types.js';
export function TransformTask({
  task,
  busy,
  onSubmit,
  submitLabel,
}: TaskRendererProps) {
  const [text, setText] = useState(''),
    id = useId();
  if (task.transformText !== undefined)
    return (
      <section
        className="curriculum-companion"
        aria-label="Чтение результата преобразования"
      >
        <p>Прочитай своё слово. Взрослый проверяет чтение.</p>
        <p className="curriculum-composition">{task.transformText}</p>
        <div className="curriculum-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({
                text: task.transformText,
                reading: { verifier: 'companion', correct: true },
              })
            }
          >
            Взрослый: прочитано верно
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onSubmit({
                text: task.transformText,
                reading: { verifier: 'companion', correct: false },
              })
            }
          >
            Взрослый: были ошибки
          </button>
        </div>
      </section>
    );
  return (
    <form
      className="curriculum-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && text.trim()) void onSubmit({ text });
      }}
    >
      <label htmlFor={id}>Напиши, что получилось</label>
      <input
        id={id}
        className="curriculum-text-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
        autoComplete="off"
        spellCheck={false}
      />
      <button type="submit" disabled={busy || !text.trim()}>
        {submitLabel || 'Ответить'}
      </button>
    </form>
  );
}
