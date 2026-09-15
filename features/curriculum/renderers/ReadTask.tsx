import type { FunctionProof } from '../../../lib/curriculum/contracts.js';
import type { TaskRendererProps } from './types.js';
export function ReadTask({ task, busy, onSubmit }: TaskRendererProps) {
  const check = task.functionCheck;
  const submit = (correct: boolean) => {
    if (check)
      return onSubmit({
        function: {
          verifier: 'companion',
          correct,
          capabilityId: check.capabilityId,
          targetHelpLevel: Math.min(
            4,
            Math.max(0, task.helpLevel),
          ) as FunctionProof['targetHelpLevel'],
        },
      });
    return onSubmit({ reading: { verifier: 'companion', correct } });
  };
  return (
    <section className="curriculum-companion" aria-label="Проверка взрослым">
      <p>
        {check?.criterion ??
          'Взрослый проверяет чтение всех частей в правильном порядке.'}
      </p>
      <div className="curriculum-actions">
        <button type="button" disabled={busy} onClick={() => void submit(true)}>
          {check ? 'Взрослый: выполнено верно' : 'Взрослый: прочитано верно'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
        >
          Взрослый: были ошибки
        </button>
        <button type="button" disabled={busy} onClick={() => void onSubmit({})}>
          Не удалось оценить
        </button>
      </div>
    </section>
  );
}
