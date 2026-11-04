import type { LessonModel } from './use-lesson';

/** Shared by long-text reading, questions and writing; no independent state. */
export default function TextDisplayControls({
  model,
}: {
  model: Pick<LessonModel, 'settings' | 'update'>;
}) {
  return (
    <div className="practice-controls">
      <label>
        Размер текста{' '}
        <select
          value={model.settings.textFontSize}
          onChange={(e) =>
            model.update(
              'textFontSize',
              Number(e.target.value) as typeof model.settings.textFontSize,
            )
          }
        >
          {[24, 28, 32, 40].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <label>
        Длинный текст{' '}
        <select
          value={model.settings.textPresentation}
          onChange={(e) =>
            model.update(
              'textPresentation',
              e.target.value as typeof model.settings.textPresentation,
            )
          }
        >
          <option value="scroll">Прокрутка</option>
          <option value="pages">Страницы</option>
        </select>
      </label>
    </div>
  );
}
