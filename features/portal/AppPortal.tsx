'use client';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import CurriculumEntry from '../onboarding/CurriculumEntry';
import TrainerEntry from '../trainers/TrainerEntry';
import { trainerDefinitions, isTrainerId } from '../trainers/catalog';
import {
  browserStorage,
  registerCurrentProfile,
  logoutProfile,
} from '../../lib/progress/profile-storage';
import LessonHeader from '../lesson/LessonHeader';
import LessonSidebar from '../lesson/LessonSidebar';
import ParentSettings from '../lesson/ParentSettings';
import RestDialog from '../lesson/RestDialog';
import MicrophoneConsent from '../lesson/MicrophoneConsent';
import type { LessonModel } from '../lesson/use-lesson';
import { stages, type Stage } from '../lesson/config';
import { textLabels, type TextKind } from '@/content/reading-library';
import Welcome from './Welcome';
import {
  FreeExposureContext,
  type ExposureRecorder,
} from '../free-practice/use-free-exposure';
import { setFreeAudioRecorder } from '../free-practice/audio';
import Cabinet from './Cabinet';
import About from './About';
import StylePicker, { type StyleValue } from './StylePicker';
import { PortalContext } from './portal-context';
import TextLibrary from '../library/TextLibrary';
import { parseProfile, profileKey, type Profile } from './profile';

const recordFree: ExposureRecorder = async (input) => {
  const service = await import('../free-practice/service.js');
  await service.recordFreeExposure(input);
};
const firstEntryKey = 'reading-first-entry-v1';

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
  const [profile, setProfile] = useState<Profile | null>(() => {
      try {
        return parseProfile(browserStorage.getItem(profileKey));
      } catch {
        return null;
      }
    }),
    [view, setView] = useState(() => {
      try {
        return parseProfile(browserStorage.getItem(profileKey)) &&
          browserStorage.getItem(firstEntryKey) === 'pending'
          ? 'curriculum'
          : 'home';
      } catch {
        return 'home';
      }
    }),
    [menuOpen, setMenuOpen] = useState(false),
    [warning, setWarning] = useState('');
  const freePractice = view === 'lesson' || view in textLabels;
  useLayoutEffect(() => {
    setFreeAudioRecorder(freePractice ? recordFree : null);
    return () => setFreeAudioRecorder(null);
  }, [freePractice]);
  const { layout, look, paper, interfaceScale } = model.settings;
  const style: StyleValue = { layout, look, paper };
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.layout = layout;
    root.dataset.look = look;
    root.dataset.paper = paper;
  }, [layout, look, paper]);
  useEffect(() => {
    document.documentElement.dataset.interfaceScale = String(interfaceScale);
    return () => {
      delete document.documentElement.dataset.interfaceScale;
    };
  }, [interfaceScale]);
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
    try {
      if (v === 'curriculum') browserStorage.setItem(firstEntryKey, 'pending');
      else if (view === 'curriculum')
        browserStorage.setItem(firstEntryKey, 'deferred');
    } catch {
      setWarning(
        'Не удалось сохранить место настройки. Прогресс заданий остаётся в сохранении.',
      );
    }
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
    const creating = !profile;
    try {
      if (creating) browserStorage.setItem(firstEntryKey, 'pending');
      registerCurrentProfile(p);
      setProfile(p);
      model.update('styleChosen', true);
      setWarning('');
    } catch {
      setWarning('Браузер не разрешил сохранить профиль. Попробуйте ещё раз.');
      return;
    }
    go(creating ? 'curriculum' : 'cabinet');
  }
  function logout() {
    model.stop();
    model.setLessonMic(false);
    try {
      logoutProfile();
    } catch {
      setWarning('Не удалось выйти из профиля. Попробуйте ещё раз.');
    }
  }
  const trainerId = view.startsWith('trainer:')
    ? view.slice('trainer:'.length)
    : '';
  // Settings and progress come from storage right after the first render; wait for them before choosing a screen.
  if (!model.ready)
    return (
      <main className="portal-panel">
        <p>Готовим твоё место…</p>
      </main>
    );
  const askStyle =
    !!profile &&
    !model.settings.styleChosen &&
    view !== 'about' &&
    view !== 'edit';
  // «Фокус» shows a task without the app header and the section menu; the task has its own bar.
  const focusActivity =
    layout === 'focus' && view === 'lesson' && !!profile && !askStyle;
  return (
    <div
      data-vision={model.settings.colorVision}
      data-audio={model.settings.sound ? 'on' : 'off'}
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
        <main
          className={'app-layout' + (focusActivity ? ' focus-activity' : '')}
        >
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
            ) : view === 'curriculum' ? (
              <CurriculumEntry
                sound={model.settings.sound}
                speak={model.speak}
                onPreferences={(q) => {
                  if (q.motionAllowed !== undefined)
                    model.update('motion', q.motionAllowed);
                  if (q.audioUsable !== undefined && q.audioUsable !== null)
                    model.update('sound', q.audioUsable);
                }}
                onExit={() => go('home')}
              />
            ) : view === 'lesson' ? (
              <FreeExposureContext.Provider value={recordFree}>
                {children}
              </FreeExposureContext.Provider>
            ) : view === 'cabinet' ? (
              <Cabinet
                profile={profile}
                stars={model.stars}
                onEdit={() => go('edit')}
                onLogout={logout}
              />
            ) : isTrainerId(trainerId) ? (
              <TrainerEntry
                key={trainerId}
                trainerId={trainerId}
                sound={model.settings.sound}
                speak={model.speak}
                onExit={() => go('home')}
              />
            ) : view in textLabels ? (
              <FreeExposureContext.Provider value={recordFree}>
                <TextLibrary key={view} kind={view as TextKind} model={model} />
              </FreeExposureContext.Provider>
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
                <button
                  className="primary"
                  onClick={() => start(profile.start)}
                >
                  Начать занятие →
                </button>
                <div className="curriculum-actions">
                  <button type="button" onClick={() => go('curriculum')}>
                    Учебные программы
                  </button>
                </div>
                <h2>Все тренажёры</h2>
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
                <h2>Ещё способы тренироваться</h2>
                <div className="portal-grid">
                  {trainerDefinitions.map((trainer) => (
                    <button
                      className="portal-card"
                      key={trainer.id}
                      onClick={() => go('trainer:' + trainer.id)}
                    >
                      <b>{trainer.title}</b>
                      <span>{trainer.description}</span>
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
