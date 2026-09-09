'use client';
import { useState } from 'react';
import { stages } from '../lesson/config';
import { textLabels } from '@/content/reading-library';
import type { Profile } from './profile';
export default function Welcome({
  profile,
  onSave,
  onCancel,
}: {
  profile: Profile | null;
  onSave: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(profile?.name || ''),
    [age, setAge] = useState(profile?.age || ''),
    [start, setStart] = useState(profile?.start || 'syllables');
  return (
    <section className="portal-panel welcome">
      <p className="eyebrow">ЧИТАЕМ ПО ШАГАМ</p>
      <h1>{profile ? 'Настроим профиль' : 'Давай знакомиться'}</h1>
      <p className="welcome-note">
        Для всех детей. Создаём с особым вниманием к детям с аутизмом, СДВГ и
        ЗПР. Здесь вам рады.
      </p>
      <p>
        Читаем, играем и отдыхаем в своём темпе. Заполните вместе со взрослым.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), age, start });
        }}
      >
        <div className="profile-fields">
          <label>
            Как тебя называть?
            <input
              required
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя или домашнее обращение"
              autoComplete="off"
            />
          </label>
          <label>
            Сколько тебе лет?
            <select
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
            >
              <option value="" disabled>
                Выберите возраст
              </option>
              {['3', '4', '5', '6', '7', '8', '9', '10', '11', '12+'].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>С чего хочешь начать?</legend>
          <div className="start-options">
            {[
              ...stages.map((s) => ({ id: s.id, name: s.name })),
              ...Object.entries(textLabels).map(([id, name]) => ({ id, name })),
            ].map((s) => (
              <label key={s.id} className={start === s.id ? 'chosen' : ''}>
                <input
                  type="radio"
                  name="start"
                  value={s.id}
                  checked={start === s.id}
                  onChange={() => setStart(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="storage-note">
          Имя, возраст, настройки и прогресс сохраняются только в этом браузере.
          Между устройствами и платформами они пока не переносятся.
          Синхронизацию добавим позже. Очистка данных браузера удалит
          сохранения.
        </p>
        <button className="primary" disabled={!name.trim() || !age}>
          Начать путешествие →
        </button>
        {onCancel && (
          <button type="button" className="text-button" onClick={onCancel}>
            Отмена
          </button>
        )}
      </form>
    </section>
  );
}
