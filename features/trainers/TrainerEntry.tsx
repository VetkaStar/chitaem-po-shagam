import type { LessonModel } from '../lesson/use-lesson';
import { useEffect, useState } from 'react';
import { loadBundledSupply } from '../../lib/curriculum/bundled.js';
import type { Supply } from '../../lib/curriculum/types.js';
import { browserStorage } from '../../lib/progress/profile-storage';
import type { IndexedDbProgressStore } from '../../lib/progress/indexed-db.js';
import type { CurriculumController } from '../curriculum/controller.js';
import { isTrainerId, trainerDefinitions } from './catalog.js';
import type { TrainerSection } from './task-section';
export interface TrainerEntryProps {
  trainerId: string;
  presentationMode?: import('../../lib/curriculum/contracts').Mode;
  model?: LessonModel;
  sound: boolean;
  speak: (text: string) => void;
  onExit: () => void;
  exitLabel?: string;
  section?: TrainerSection;
  title?: string;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}
export default function TrainerEntry(props: TrainerEntryProps) {
  const [ready, setReady] = useState<{
    controller: CurriculumController;
    supply: Supply;
    Screen: typeof import('./TrainerSession.js').default;
    PartsScreen: typeof import('./TrainerLessonSession').default;
  } | null>(null);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    props.onBusyChange?.(!ready && !error);
  }, [ready, error, props.onBusyChange]);
  useEffect(() => {
    let cancelled = false;
    let store: IndexedDbProgressStore | undefined;
    setReady(null);
    setError(false);
    void (async () => {
      try {
        const [supply, storage, runtime, screen, partsScreen] =
          await Promise.all([
            loadBundledSupply(),
            import('../../lib/progress/indexed-db.js'),
            import('../curriculum/controller.js'),
            import('./TrainerSession.js'),
            import('./TrainerLessonSession'),
          ]);
        const exposures = await import('../free-practice/service');
        await exposures.waitForFreeExposure();
        if (cancelled) return;
        store = new storage.IndexedDbProgressStore(supply);
        const controller = await runtime.CurriculumController.open(
          supply,
          store,
          browserStorage,
        );
        if (!cancelled)
          setReady({
            controller,
            supply,
            Screen: screen.default,
            PartsScreen: partsScreen.default,
          });
      } catch {
        if (!cancelled) setError(true);
        if (store) await store.close().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
      if (store) void store.close().catch(() => undefined);
    };
  }, [attempt]);
  if (!isTrainerId(props.trainerId))
    return (
      <section className="portal-panel">
        <h1>Тренажёр не найден</h1>
        <button onClick={props.onExit}>
          {props.exitLabel ?? 'Все тренажёры'}
        </button>
      </section>
    );
  if (ready && props.model && props.section)
    return (
      <ready.PartsScreen
        controller={ready.controller}
        supply={ready.supply}
        model={props.model}
        kind={props.trainerId}
        section={props.section}
        mode={props.presentationMode}
        onBusyChange={props.onBusyChange}
      />
    );
  if (ready)
    return (
      <ready.Screen
        key={props.trainerId}
        {...props}
        trainerId={props.trainerId}
        controller={ready.controller}
        supply={ready.supply}
      />
    );
  const title =
    props.title ??
    trainerDefinitions.find((definition) => definition.id === props.trainerId)!
      .title;
  return (
    <section className="portal-panel" aria-label={title} aria-busy={!error}>
      {!props.embedded && <h1>{title}</h1>}
      {error ? (
        <div role="alert">
          <p>Не удалось открыть тренажёр или сохранение.</p>
          <button onClick={() => setAttempt((value) => value + 1)}>
            Повторить попытку
          </button>
        </div>
      ) : (
        <p role="status">Готовим задания…</p>
      )}
      {!props.embedded && (
        <button onClick={props.onExit}>
          {props.exitLabel ?? 'Все тренажёры'}
        </button>
      )}
    </section>
  );
}
