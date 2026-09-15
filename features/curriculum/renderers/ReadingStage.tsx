import type { TaskRendererProps } from './types.js';
export function ReadingStage({
  task,
  busy,
  onReading,
  onReveal,
}: TaskRendererProps) {
  if (!task.readingStageFinished)
    return (
      <section
        className="curriculum-reading-stage"
        aria-label="Завершение чтения"
      >
        <p>
          Взрослый может отметить результат чтения. Без проверки можно
          продолжить без оценки.
        </p>
        <div className="curriculum-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onReading({ verifier: 'companion', correct: true })
            }
          >
            Взрослый: прочитано верно
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void onReading({ verifier: 'companion', correct: false })
            }
          >
            Взрослый: были ошибки
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReading()}
          >
            Продолжить без оценки чтения
          </button>
        </div>
      </section>
    );
  if (!task.optionsRevealed)
    return (
      <div className="curriculum-actions">
        <button type="button" disabled={busy} onClick={() => void onReveal()}>
          Открыть варианты ответа
        </button>
      </div>
    );
  return null;
}
