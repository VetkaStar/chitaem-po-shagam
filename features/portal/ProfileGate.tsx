import { useState, type ReactNode } from 'react';
import {
  bootProfile,
  listLocalProfiles,
  chooseProfile,
} from '../../lib/progress/profile-storage';

export default function ProfileGate({ children }: { children: ReactNode }) {
  const [state] = useState(() => {
    try {
      return {
        active: bootProfile(),
        profiles: listLocalProfiles(),
        error: '',
      };
    } catch {
      return {
        active: false,
        profiles: [],
        error:
          'Не удалось прочитать профили. Данные не удалены. Разрешите хранение данных сайта и повторите попытку.',
      };
    }
  });
  const [error, setError] = useState(state.error);
  if (state.active) return children;
  const choose = (id?: string) => {
    try {
      chooseProfile(id);
    } catch {
      setError(
        'Не удалось открыть профиль. Данные сохранены. Попробуйте ещё раз.',
      );
    }
  };
  return (
    <main className="portal-panel profile-picker">
      <p className="eyebrow">ЧИТАЕМ ПО ШАГАМ</p>
      <h1>Кто будет заниматься?</h1>
      <p>У каждого профиля свои занятия и прогресс в этом браузере.</p>
      {error && <p role="alert">{error}</p>}
      <div className="portal-grid">
        {state.profiles.map((profile) => (
          <button
            className="portal-card"
            key={profile.id}
            onClick={() => choose(profile.id)}
          >
            <b>{profile.name}</b>
            <span>Продолжить занятия</span>
          </button>
        ))}
      </div>
      {!state.error && (
        <button className="primary" onClick={() => choose()}>
          Создать новый профиль
        </button>
      )}
      {state.error && (
        <button onClick={() => location.reload()}>Повторить попытку</button>
      )}
    </main>
  );
}
