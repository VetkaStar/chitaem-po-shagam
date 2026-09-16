import AutoAdvanceSettings from '../../components/auto-advance-settings';
import PracticeMenu from '../../components/practice-menu';
import type { LessonModel } from '../lesson/use-lesson';

export default function TrainerPracticeSettings({
  model,
}: {
  model: LessonModel;
}) {
  return (
    <PracticeMenu>
      <AutoAdvanceSettings model={model} />
      <div className="practice-controls" aria-label="Настройки упражнения">
        <label>
          Заданий в занятии{' '}
          <select
            value={model.settings.length}
            onChange={(event) =>
              model.update('length', Number(event.target.value))
            }
          >
            {[3, 5, 8].map((length) => (
              <option key={length} value={length}>
                {length}
              </option>
            ))}
          </select>
        </label>
        <p>
          Длина применяется со следующего занятия. В короткой теме заданий может
          быть меньше.
        </p>
        <label>
          <input
            type="checkbox"
            checked={model.settings.sound}
            onChange={(event) => model.update('sound', event.target.checked)}
          />
          Озвучка
        </label>
        <label>
          <input
            type="checkbox"
            checked={model.settings.color}
            onChange={(event) => model.update('color', event.target.checked)}
          />
          Выделять гласные цветом
        </label>
      </div>
    </PracticeMenu>
  );
}
