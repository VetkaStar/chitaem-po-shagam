'use client';
import TrainerWorkspace from '../trainers/TrainerWorkspace';
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import CurriculumEntry from '../onboarding/CurriculumEntry';
import TrainerEntry from '../trainers/TrainerEntry';
import type { AnswerSection } from '../answers/types';
import LessonWorkspace from '../lesson/LessonWorkspace';
import AnswerEntry from '../answers/AnswerEntry';
import AnswerSettings from '../answers/AnswerSettings';
import { isTrainerId } from '../trainers/catalog';
import SectionTrainers from '../trainers/SectionTrainers';
import { sections, findTrainerLink } from '../trainers/navigation';
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
  children: ReactNode | ((onAnswer: () => void) => ReactNode);
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
    model.setExternalActivity(v.startsWith('answer:'));
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
    if (/^lesson:(letters|syllables|words):answer$/.test(id)) {
      const stage = id.split(':')[1] as Stage;
      if (model.stage !== stage) model.navigate(stage, 'read');
      go('answer:' + stage);
      return;
    }
    if (id.startsWith('lesson:')) {
      const [, stage, mode] = id.split(':');
      if (
        !mode &&
        model.stage === stage &&
        (view === 'lesson' || view.startsWith('answer:'))
      ) {
        setMenuOpen(false);
        return;
      }
      model.navigate(
        stage as Stage,
        (mode || 'read') as 'read' | 'fly' | 'type',
      );
      go('lesson');
      return;
    }
    if (id.startsWith('picture:')) {
      model.update('pictureMode', id.endsWith(':letters') ? 'letters' : 'free');
      model.navigate('pictures', 'read');
      go('lesson');
      return;
    }
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
  const trainerId = view.startsWith('trainer:') ? view.split(':')[1] : '';
  const section = sections.find(
    (s) =>
      s.id ===
      view.split(':')[
        view.startsWith('trainer:') || view.startsWith('group:') ? 2 : 1
      ],
  );
  const selectedTrainer = findTrainerLink(view);
  const selectedItem = view.startsWith('answer:')
    ? 'lesson:' + view.split(':')[1]
    : view === 'lesson'
      ? `lesson:${model.stage}`
      : view;
  useEffect(() => {
    if (view.startsWith('answer:') && model.stage !== view.split(':')[1])
      go('lesson');
  }, [view, model.stage]);
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
    layout === 'focus' &&
    (view === 'lesson' ||
      view.startsWith('answer:') ||
      view.startsWith('group:parts:') ||
      view.startsWith('trainer:read_meaning:')) &&
    !!profile &&
    !askStyle;
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
            active={view === 'lesson' ? model.stage : (section?.id ?? view)}
            selectedItem={selectedItem}
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
                onVoiceChange={(voice) => { model.update('voice', voice); model.update('narrator', voice === 'male' ? 'piper-denis' : 'piper-irina'); }}
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
                settings={model.settings}
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
            ) : view.startsWith('section:') && section ? (
              <SectionTrainers section={section} onSelect={start} />
            ) : view === 'lesson' ? (
              <FreeExposureContext.Provider value={recordFree}>
                {typeof children === 'function'
                  ? children(() => start('lesson:' + model.stage + ':answer'))
                  : children}
              </FreeExposureContext.Provider>
            ) : view.startsWith('answer:') ? (
              <LessonWorkspace
                model={model}
                answer
                onAnswer={() => {}}
                onPractice={(mode) =>
                  start('lesson:' + model.stage + ':' + mode)
                }
                controls={<AnswerSettings model={model} />}
              >
                <AnswerEntry
                  key={view + ':' + model.settings.unit}
                  model={model}
                  section={view.split(':')[1] as AnswerSection}
                />
              </LessonWorkspace>
            ) : selectedTrainer &&
              section &&
              (selectedTrainer.modes || trainerId === 'read_meaning') ? (
              <TrainerWorkspace
                key={selectedTrainer.id}
                trainer={selectedTrainer}
                section={section.id}
                model={model}
                onExit={() => go(`section:${section.id}`)}
              />
            ) : view === 'cabinet' ? (
              <Cabinet
                profile={profile}
                stars={model.stars}
                onEdit={() => go('edit')}
                onLogout={logout}
              />
            ) : isTrainerId(trainerId) ? (
              <TrainerEntry
                key={view}
                trainerId={trainerId}
                section={section?.id}
                title={findTrainerLink(view)?.title}
                sound={model.settings.sound}
                speak={model.speak}
                exitLabel={
                  section ? `К разделу «${section.name}»` : 'Все тренажёры'
                }
                onExit={() => go(section ? 'section:' + section.id : 'home')}
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
                      onClick={() => {
                        const entry = sections.find(
                          (section) => section.id === s.id,
                        )!;
                        if (entry.items.length === 1) start(entry.items[0].id);
                        else go('section:' + s.id);
                      }}
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
