import PracticeMenu from '../../components/practice-menu';
import type { LessonModel } from '../lesson/use-lesson';
export default function AnswerSettings({ model }: { model: LessonModel }) {
  return (
    <PracticeMenu>
      <div className="practice-controls">
        <label>
          Заданий в занятии{' '}
          <select
            value={model.settings.length}
            onChange={(event) =>
              model.update('length', Number(event.target.value))
            }
          >
            {[3, 5, 8].map((n) => (
              <option key={n} value={n}>
                {n}
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
      </div>
    </PracticeMenu>
  );
}
