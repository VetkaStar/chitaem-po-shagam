'use client';
import type { LessonModel } from './use-lesson';
export default function PracticeControls({ model: m }: { model: LessonModel }) {
  return (
    <div className="practice-controls" aria-label="Настройки упражнения">
      <button
        aria-pressed={m.settings.color}
        onClick={() => m.update('color', !m.settings.color)}
      >
        Цветные буквы: {m.settings.color ? 'вкл' : 'выкл'}
      </button>
      {m.stage === 'pictures' && (
        <label>
          Ответ{' '}
          <select
            aria-label="Режим картинок"
            value={m.settings.pictureMode}
            onChange={(e) =>
              m.update('pictureMode', e.target.value as 'free' | 'letters')
            }
          >
            <option value="free">Свободный ответ</option>
            <option value="letters">Окошки для букв</option>
          </select>
        </label>
      )}
      {m.stage === 'words' && m.mode === 'read' && (
        <label>
          Читаем{' '}
          <select
            aria-label="Режим чтения слов"
            value={m.settings.wordMode}
            onChange={(e) =>
              m.update('wordMode', e.target.value as 'whole' | 'parts')
            }
          >
            <option value="whole">Слово целиком</option>
            <option value="parts">По слогам</option>
          </select>
        </label>
      )}
      {m.stage === 'letters' && (
        <label>
          Учимся{' '}
          <select
            aria-label="Звуки или алфавит"
            value={m.settings.letterMode}
            onChange={(e) =>
              m.update('letterMode', e.target.value as 'sounds' | 'alphabet')
            }
          >
            <option value="sounds">Звуки</option>
            <option value="alphabet">Алфавит — названия букв</option>
          </select>
        </label>
      )}
      {m.stage === 'letters' && m.settings.letterMode === 'alphabet' && (
        <label>
          Показывать{' '}
          <select
            aria-label="Вид букв"
            value={m.settings.letterCase}
            onChange={(e) =>
              m.update(
                'letterCase',
                e.target.value as 'upper' | 'lower' | 'both',
              )
            }
          >
            <option value="upper">Заглавные — Б</option>
            <option value="lower">Строчные — б</option>
            <option value="both">Обе — Б б</option>
          </select>
        </label>
      )}
      {m.mode === 'fly' && (
        <label>
          Скорость{' '}
          <select
            aria-label="Скорость карточек"
            value={m.settings.flySpeed}
            onChange={(e) => m.update('flySpeed', Number(e.target.value))}
          >
            <option value="0.5">Очень медленно</option>
            <option value="1">Медленно</option>
            <option value="1.5">Быстрее</option>
            <option value="2">Быстро</option>
          </select>
        </label>
      )}
    </div>
  );
}
