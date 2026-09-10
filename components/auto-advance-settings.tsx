'use client';
import type { LessonModel } from '@/features/lesson/use-lesson';
import './auto-advance.css';
export default function AutoAdvanceSettings({
  model,
}: {
  model: Pick<LessonModel, 'settings' | 'update'>;
}) {
  return (
    <div className="auto-settings">
      <label>
        <input
          type="checkbox"
          checked={model.settings.autoAdvance}
          onChange={(e) => model.update('autoAdvance', e.target.checked)}
        />
        Автоматически переходить дальше
      </label>
      {model.settings.autoAdvance && (
        <label>
          Через{' '}
          <input
            aria-label="Задержка автоперехода в секундах"
            type="number"
            min={1}
            max={30}
            value={model.settings.autoAdvanceSeconds}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 30)
                model.update('autoAdvanceSeconds', n);
            }}
          />{' '}
          секунд
        </label>
      )}
    </div>
  );
}
