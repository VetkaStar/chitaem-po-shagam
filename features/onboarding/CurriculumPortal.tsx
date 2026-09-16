import { useEffect, useState } from 'react';
import { browserStorage } from '../../lib/progress/profile-storage';
import { loadBundledSupply } from '../../lib/curriculum/bundled.js';
import type { Supply } from '../../lib/curriculum/types.js';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db.js';
import { CurriculumController } from '../curriculum/controller.js';
import EntryRoot from '../entry08/EntryRoot';
export interface CurriculumPortalProps {
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
  if (ready)
    return (
      <EntryRoot
        {...props}
        controller={ready.controller}
        supply={ready.supply}
      />
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
