'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Home, UserRound, Info, BookOpen } from 'lucide-react';
import type { LessonModel } from '../lesson/use-lesson';
import { stages, type Stage } from '../lesson/config';
import { textLabels, type TextKind } from '@/content/reading-library';
import Welcome from './Welcome';
import Cabinet from './Cabinet';
import About from './About';
import TextLibrary from '../library/TextLibrary';
import { parseProfile, profileKey, type Profile } from './profile';
export default function AppPortal({
  model,
  children,
}: {
  model: LessonModel;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [loaded, setLoaded] = useState(false),
    [view, setView] = useState('home'),
    [warning, setWarning] = useState('');
  useEffect(() => {
    try {
      setProfile(parseProfile(localStorage.getItem(profileKey)));
    } catch {}
    setLoaded(true);
  }, []);
  function go(v: string) {
    model.setLessonActive(v === 'lesson');
    model.stop();
    model.setLessonMic(false);
    model.setPaused(v !== 'lesson');
    setView(v);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function start(id: string) {
    if (stages.some((s) => s.id === id)) {
      model.navigate(id as Stage, 'read');
      go('lesson');
    } else go(id);
  }
  function save(p: Profile) {
    setProfile(p);
    try {
      localStorage.setItem(profileKey, JSON.stringify(p));
      setWarning('');
    } catch {
      setWarning(
        'Браузер не разрешил сохранить профиль. После закрытия страницы данные могут пропасть.',
      );
    }
    start(p.start);
  }
  if (!loaded)
    return (
      <main className="portal-panel">
        <p>Готовим твоё место…</p>
      </main>
    );
  return (
    <div className={model.settings.motion ? 'motion' : 'calm'}>
      <nav className="portal-nav" aria-label="Главное меню">
        <button onClick={() => go('home')}>
          <Home size={19} /> Главная
        </button>
        <button onClick={() => go('lesson')} disabled={!profile}>
          <BookOpen size={19} /> Занятие
        </button>
        <button onClick={() => go('cabinet')} disabled={!profile}>
          <UserRound size={19} /> Мой кабинет
        </button>
        <button onClick={() => go('about')}>
          <Info size={19} /> О проекте
        </button>
      </nav>
      {warning && (
        <p role="alert" className="storage-note">
          {warning}
        </p>
      )}
      {view === 'about' ? (
        <About />
      ) : !profile || view === 'edit' ? (
        <Welcome
          profile={profile}
          onSave={save}
          onCancel={profile ? () => go('cabinet') : undefined}
        />
      ) : view === 'lesson' ? (
        <>
          <div className="extra-sections" aria-label="Продолжаем читать">
            {Object.entries(textLabels).map(([id, label]) => (
              <button key={id} onClick={() => start(id)}>
                {label} →
              </button>
            ))}
          </div>
          {children}
        </>
      ) : view === 'cabinet' ? (
        <Cabinet
          profile={profile}
          stars={model.stars}
          onEdit={() => go('edit')}
        />
      ) : view in textLabels ? (
        <TextLibrary key={view} kind={view as TextKind} model={model} />
      ) : (
        <section className="portal-panel">
          <p className="eyebrow">ЧИТАЕМ ПО ШАГАМ · by Vetka_Star</p>
          <h1>Привет, {profile.name}!</h1>
          <p className="welcome-note">
            Для всех детей. Создаём с особым вниманием к детям с аутизмом, СДВГ
            и ЗПР. Здесь вам рады.
          </p>
          <p>
            Сегодня можно сделать один маленький шаг. Выбери, что тебе
            интересно.
          </p>
          <button className="primary" onClick={() => start(profile.start)}>
            Начать занятие →
          </button>
          <h2>Твоя тропинка чтения</h2>
          <div className="portal-grid">
            {[
              ...stages.map((s) => ({ id: s.id, name: s.name })),
              ...Object.entries(textLabels).map(([id, name]) => ({ id, name })),
            ].map((s, i) => (
              <button
                className="portal-card"
                key={s.id}
                onClick={() => start(s.id)}
              >
                <small>ШАГ {i + 1}</small>
                <b>{s.name}</b>
                <span>
                  {
                    [
                      'Узнаём буквы',
                      'Соединяем звуки и собираем слова',
                      'Читаем целое слово',
                      'Называем то, что видим',
                      'Слова дружат друг с другом',
                      'Читаем и понимаем',
                      'Слушаем ритм и читаем',
                    ][i]
                  }
                </span>
              </button>
            ))}
          </div>
          <p className="storage-note">
            Прогресс сохраняется в этом браузере. Перенос на другие устройства
            добавим позже.
          </p>
        </section>
      )}
      <footer className="portal-footer">
        <span>by Vetka_Star</span>
        <button className="text-button" onClick={() => go('about')}>
          О проекте и поддержка
        </button>
      </footer>
    </div>
  );
}
