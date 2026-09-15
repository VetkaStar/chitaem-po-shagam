import { useRef, useState } from 'react';
import type { CurriculumController } from './controller.js';
import type { Presentation } from './presentation.js';
const launchable = new Set([
  'active_task',
  'active_info',
  'episode_task',
  'episode_info',
  'context_info',
  'correction_info',
  'correction_task',
  'check',
  'application',
  'review',
  'custom_task',
  'demonstration_task',
  'demonstration_info',
]);
export function useCurriculumSession(controller: CurriculumController) {
  const [state, setState] = useState(() => controller.snapshot());
  const [view, setView] = useState<Presentation | null>(() =>
    controller.visible(),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const lock = useRef(false);
  const sync = () => {
    setState(controller.snapshot());
    setView(controller.visible());
  };
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      sync();
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes('REVISION_CONFLICT')
          ? 'Сохранение изменилось в другой вкладке. Перечитай его, прежде чем продолжать.'
          : 'Не удалось сохранить действие. Текущий шаг остаётся на месте.',
      );
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const next = async () => {
    const plan = await controller.planNext();
    if (launchable.has(plan.kind)) {
      await controller.launch(plan);
      setStatus('');
    } else setStatus(plan.kind);
  };
  const act = (action: () => Promise<unknown>) => {
    void run(action).catch(() => undefined);
  };
  return { state, view, busy, error, status, run, act, next, setStatus };
}
