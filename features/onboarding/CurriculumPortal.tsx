import { useEffect, useState } from 'react';
import { browserStorage } from '../../lib/progress/profile-storage';
import { loadBundledSupply } from '../../lib/curriculum/bundled.js';
import type { Supply } from '../../lib/curriculum/types.js';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db.js';
import { CurriculumController } from '../curriculum/controller.js';
import EntryRoot from '../entry08/EntryRoot';
import CurriculumSession from '../curriculum/CurriculumSession';
import ProgramOverview from './ProgramOverview';
export interface CurriculumPortalProps {
  catalog?: boolean;
  suspended?: boolean;
  settings: import('../lesson/config').Settings;
  onPreferences?: (
    q: import('../../lib/curriculum/types.js').Questionnaire,
  ) => void;
  sound: boolean;
  speak: (text: string) => void;
  onExit: () => void;
}
interface Ready {
  supply: Supply;
  controller: CurriculumController;
}
export default function CurriculumPortal(props: CurriculumPortalProps) {
  const [screen, setScreen] = useState<'catalog' | 'personal' | 'program' | 'report'>(props.catalog ? 'catalog' : 'personal');
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [ready, setReady] = useState<Ready | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let store: IndexedDbProgressStore | undefined;
    setReady(null);
    setError(false);
    const open = async () => {
      try {
        const supply = await loadBundledSupply();
        const exposures = await import('../free-practice/service');
        await exposures.waitForFreeExposure();
        if (cancelled) return;
        store = new IndexedDbProgressStore(supply);
        const controller = await CurriculumController.open(
          supply,
          store,
          browserStorage,
        );
        if (!cancelled) setReady({ supply, controller });
      } catch {
        if (!cancelled) setError(true);
        if (store) await store.close().catch(() => undefined);
      }
    };
    void open();
    return () => {
      cancelled = true;
      if (store) void store.close().catch(() => undefined);
    };
  }, [attempt]);
  if (ready && screen === 'catalog')
    return (
      <section className="portal-panel" aria-label="Учебные программы" aria-busy={selecting}>
        <p className="eyebrow">УЧЕБНЫЕ ПРОГРАММЫ</p>
        <h1>Выбери свой путь</h1>
        <p>Личная дорожка подбирает начало по короткому знакомству. Авторские программы можно проходить по порядку. Свободные тренажёры доступны в любой момент.</p>
        <div className="portal-grid">
          <button className="portal-card" disabled={selecting} onClick={() => setScreen('personal')}>
            <b>Моя дорожка</b><span>Продолжить с сохранённого места или пройти короткое знакомство.</span>
          </button>
          {ready.supply.curriculum.programs.map((program) => (
            <button className="portal-card" key={program.id} disabled={selecting} onClick={async () => {
              setSelecting(true);
              setSelectionError('');
              try {
                await ready.controller.selectProgram(program.id);
                setScreen('program');
              } catch {
                setSelectionError('Не удалось открыть программу. Попробуй ещё раз.');
              } finally { setSelecting(false); }
            }}><b>{program.title}</b><span>Открыть программу · своё сохранённое место</span></button>
          ))}
        </div>
        {selectionError && <p role="alert">{selectionError}</p>}
        <div className="curriculum-actions">
          <button onClick={() => setScreen('report')} disabled={selecting}>Результаты учебных программ</button>
          <button onClick={props.onExit} disabled={selecting}>К тренажёрам</button>
        </div>
      </section>
    );
  if (ready && screen === 'report')
    return <ProgramOverview {...ready} onContinue={() => setScreen('program')}
      onPersonal={() => setScreen('personal')} onExit={() => setScreen('catalog')} />;
  if (ready && screen === 'program')
    return <CurriculumSession controller={ready.controller}
      programs={ready.supply.curriculum.programs} sound={props.sound} speak={props.speak}
      onExit={props.onExit} onRoadmap={() => setScreen('catalog')} roadmapLabel="К выбору программы" />;
  if (ready)
    return (
      <>
      {props.catalog && <button onClick={() => setScreen('catalog')}>К выбору программы</button>}
      <EntryRoot
        {...props}
        controller={ready.controller}
        supply={ready.supply}
      />
      </>
    );
  return (
    <section
      className="portal-panel"
      aria-label="Учебные программы"
      aria-busy={!error}
    >
      <h1>Учебные программы</h1>
      {error ? (
        <div role="alert">
          <p>
            Не удалось открыть учебные программы или сохранение. Можно повторить
            попытку или перейти к тренажёрам.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Повторить попытку
          </button>
        </div>
      ) : (
        <p role="status">Готовим учебные программы…</p>
      )}
      <button type="button" onClick={props.onExit}>
        Все тренажёры
      </button>
    </section>
  );
}
