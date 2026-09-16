import { useEffect, useState } from 'react';
import type { LessonModel } from '../lesson/use-lesson';
import type { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { browserStorage } from '../../lib/progress/profile-storage';

export default function AnswerEntry({ model }: { model: LessonModel }) {
  const [ready, setReady] = useState<{
    controller: CurriculumController;
    supply: Supply;
    Screen: typeof import('./AnswerSession').default;
  } | null>(null);
  const [attempt, setAttempt] = useState(0),
    [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false,
      store: IndexedDbProgressStore | undefined;
    setError(false);
    void (async () => {
      try {
        const [bank, storage, runtime, screen] = await Promise.all([
          import('../../lib/curriculum/bundled'),
          import('../../lib/progress/indexed-db'),
          import('../curriculum/controller'),
          import('./AnswerSession'),
        ]);
        const supply = await bank.loadBundledSupply();
        if (cancelled) return;
        store = new storage.IndexedDbProgressStore(supply);
        const controller = await runtime.CurriculumController.open(
          supply,
          store,
          browserStorage,
        );
        if (!cancelled)
          setReady({ controller, supply, Screen: screen.default });
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (store) void store.close().catch(() => undefined);
    };
  }, [attempt]);
  if (ready)
    return (
      <ready.Screen
        key={model.settings.unit}
        controller={ready.controller}
        supply={ready.supply}
        model={model}
      />
    );
  return (
    <div className="exercise" aria-busy={!error}>
      {error ? (
        <>
          <p role="alert">Не удалось открыть задания. Сохранения не удалены.</p>
          <button onClick={() => setAttempt((n) => n + 1)}>
            Повторить попытку
          </button>
        </>
      ) : (
        <p role="status">Готовим вопрос…</p>
      )}
    </div>
  );
}
