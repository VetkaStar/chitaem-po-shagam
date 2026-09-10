import type { LessonModel } from './use-lesson';
export default function ReadingGuideControls({
  model,
  wordOnly = false,
}: {
  model: Pick<LessonModel, 'settings' | 'update'>;
  wordOnly?: boolean;
}) {
  return (
    <div className="practice-controls">
      <label>
        Выбирать{' '}
        <select
          aria-label="Выбор части для чтения"
          value={
            wordOnly && model.settings.readingFocus === 'line'
              ? 'word'
              : model.settings.readingFocus
          }
          onChange={(e) =>
            model.update(
              'readingFocus',
              e.target.value as 'line' | 'word' | 'syllable',
            )
          }
        >
          {!wordOnly && <option value="line">Строку</option>}
          <option value="word">Слово</option>
          <option value="syllable">Слог</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={model.settings.readingHighlight}
          onChange={(e) => model.update('readingHighlight', e.target.checked)}
        />{' '}
        Подсвечивать, что читать
      </label>
    </div>
  );
}
