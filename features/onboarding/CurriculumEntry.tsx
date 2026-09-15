import { useEffect, useState, type ComponentType } from 'react';
import type { CurriculumPortalProps } from './CurriculumPortal.js';
/** Fetch the optional screen only on entry; failed chunk requests can be retried. */
export default function CurriculumEntry(props: CurriculumPortalProps) {
  const [Screen, setScreen] =
    useState<ComponentType<CurriculumPortalProps> | null>(null);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    void import('../onboarding/CurriculumPortal.js')
      .then((module) => {
        if (!cancelled) setScreen(() => module.default);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  if (Screen) return <Screen {...props} />;
  return (
    <section
      className="portal-panel"
      aria-label="Учебные программы"
      aria-busy={!error}
    >
      <h1>Учебные программы</h1>
      {error ? (
        <div role="alert">
          <p>Не удалось загрузить учебные программы.</p>
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
