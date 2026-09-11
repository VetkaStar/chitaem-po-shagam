'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { visionStyle } from '@/lib/vision';
import LessonHeader from '../lesson/LessonHeader';
import LessonSidebar from '../lesson/LessonSidebar';
import ParentSettings from '../lesson/ParentSettings';
import RestDialog from '../lesson/RestDialog';
import MicrophoneConsent from '../lesson/MicrophoneConsent';
import type { LessonModel } from '../lesson/use-lesson';
import { stages, type Stage } from '../lesson/config';
import { textLabels, type TextKind } from '@/content/reading-library';
import Welcome from './Welcome';
import Cabinet from './Cabinet';
import About from './About';
import StylePicker, { type StyleValue } from './StylePicker';
import { PortalContext } from './portal-context';
import TextLibrary from '../library/TextLibrary';
import { parseProfile, profileKey, type Profile } from './profile';

/** Shown once to children who already had a profile before the look could be chosen. */
function StyleChoice({
  value,
  onChange,
  onDone,
}: {
  value: StyleValue;
  onChange: (next: StyleValue) => void;
  onDone: () => void;
}) {
  return (
    <section className="portal-panel style-choice">
      <p className="eyebrow">ЧИТАЕМ ПО ШАГАМ</p>
      <h1>Какой вид удобнее?</h1>
      <p>
        Появился выбор вида приложения. Выберите вместе с ребёнком. Поменять
        можно в любой момент в «Для взрослого».
      </p>
      <StylePicker value={value} onChange={onChange} name="first-style" />
      <button className="primary" onClick={onDone}>
        Продолжить →
      </button>
    </section>
  );
}

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
    [menuOpen, setMenuOpen] = useState(false),
    [warning, setWarning] = useState('');
  const { layout, look, paper } = model.settings;
  const style: StyleValue = { layout, look, paper };
  useEffect(() => {
    try {
      setProfile(parseProfile(localStorage.getItem(profileKey)));
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = layout;
    root.dataset.look = look;
    root.dataset.paper = paper;
  }, [layout, look, paper]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  function changeStyle(next: StyleValue) {
    model.update('layout', next.layout);
    model.update('look', next.look);
    model.update('paper', next.paper);
  }
  function go(v: string) {
    model.setLessonActive(v === 'lesson');
    model.stop();
    model.setLessonMic(false);
    model.setPaused(false);
    model.setRest(false);
    model.setParent(false);
    setMenuOpen(false);
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
    model.update('styleChosen', true);
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
  const askStyle = !!profile && !model.settings.styleChosen && view !== 'about' && view !== 'edit';
  // «Фокус» shows a task without the app header and the section menu; the task has its own bar.
  const focusActivity = layout === 'focus' && view === 'lesson' && !!profile && !askStyle;
  return (
    <div
      data-vision={model.settings.colorVision}
      data-audio={model.settings.sound ? 'on' : 'off'}
      style={visionStyle(model.settings.colorVision)}
      className={'app-root ' + (model.settings.motion ? 'motion' : 'calm')}
    >
      {!focusActivity && (
        <LessonHeader
          model={model}
          onHome={() => go('home')}
          onCabinet={() => go('cabinet')}
          onMenu={() => setMenuOpen(true)}
          active={view}
          hasProfile={!!profile}
        />
      )}
      <PortalContext.Provider value={{ home: () => go('home') }}>
      <main className={'app-layout' + (focusActivity ? ' focus-activity' : '')}>
        <LessonSidebar
          model={model}
          active={view === 'lesson' ? model.stage : view}
          onSelect={start}
          onAbout={() => go('about')}
          onCabinet={() => go('cabinet')}
          onClose={() => setMenuOpen(false)}
          open={menuOpen}
          disabled={!profile}
        />
        <div className="app-content">
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
              voice={model.settings.voice}
              onVoiceChange={(voice) => model.update('voice', voice)}
              style={style}
              onStyleChange={changeStyle}
              onSave={save}
              onCancel={profile ? () => go('cabinet') : undefined}
            />
          ) : askStyle ? (
            <StyleChoice
              value={style}
              onChange={changeStyle}
              onDone={() => model.update('styleChosen', true)}
            />
          ) : view === 'lesson' ? (
            children
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
                Для всех детей. Создаём с особым вниманием к детям с аутизмом,
                СДВГ и ЗПР. Здесь вам рады.
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
                  ...Object.entries(textLabels).map(([id, name]) => ({
                    id,
                    name,
                  })),
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
                Прогресс сохраняется в этом браузере. Перенос на другие
                устройства добавим позже.
              </p>
            </section>
          )}
          <footer className="portal-footer">
            <span>by Vetka_Star</span>
            <button className="footer-about" onClick={() => go('about')}>
              О проекте
            </button>
          </footer>
        </div>
      </main>
      </PortalContext.Provider>
      <ParentSettings model={model} />
      <RestDialog model={model} />
      <MicrophoneConsent model={model} />
    </div>
  );
}
