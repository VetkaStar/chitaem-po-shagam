import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { FreeExposure } from '../../lib/curriculum/free-exposure.js';
import { setMaterialPending } from './material-ready';
import { registerFreeTexts } from './audio.js';
export type ExposureRecorder = (input: FreeExposure) => Promise<void>;
export const FreeExposureContext = createContext<ExposureRecorder | null>(null);
/** The caller owns exercise state; only its material waits for durable storage. */
export function useFreeExposure(input: FreeExposure): {
  ready: boolean;
  blocker: ReactNode;
} {
  const record = useContext(FreeExposureContext);
  const key = JSON.stringify(input);
  const [saved, setSaved] = useState(''),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const empty = ![
    ...(input.texts ?? []),
    ...(input.promptedTexts ?? []),
    ...(input.heardPassages ?? []),
  ].some((x) => x.trim());
  useEffect(() => {
    if (!record || empty) return;
    let cancelled = false;
    setError(false);
    const exposure: FreeExposure = JSON.parse(key);
    registerFreeTexts(exposure);
    void record(exposure)
      .then(() => {
        if (!cancelled) setSaved(key);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [record, key, attempt, empty]);
  const ready = !record || empty || saved === key;
  const id = useRef({});
  useLayoutEffect(() => {
    setMaterialPending(id.current, !ready);
    return () => setMaterialPending(id.current, false);
  }, [ready]);
  return {
    ready,
    blocker: (
      <section className="curriculum-step" aria-busy={!error}>
        {error ? (
          <div role="alert">
            <p>Не удалось сохранить показ материала.</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Повторить попытку
            </button>
            <p>Можно вернуться к разделам через верхнее меню.</p>
          </div>
        ) : (
          <p role="status">Готовим задание…</p>
        )}
      </section>
    ),
  };
}
