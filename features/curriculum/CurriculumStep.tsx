import type { CurriculumController } from './controller.js';
import type { Presentation } from './presentation.js';
import type { Outcome } from '../../lib/curriculum/contracts.js';
import { TaskRenderer } from './TaskRenderer.js';
import { CurriculumIllustration } from './CurriculumIllustration.js';
interface Props {
  view: Presentation;
  controller: CurriculumController;
  busy: boolean;
  sound: boolean;
  instructionSound?: boolean;
  speak: (text: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  onResult: (outcome: Outcome) => void;
}
export function CurriculumStep({
  view,
  controller,
  busy,
  sound,
  instructionSound = sound,
  speak,
  run,
  onResult,
}: Props) {
  const act = (fn: () => Promise<unknown>) => {
    void run(fn).catch(() => undefined);
  };
  const instruction = (
    <div className="curriculum-instruction">
      {sound && instructionSound && (
        <button
          disabled={busy}
          aria-label="Послушать инструкцию"
          onClick={() => speak(view.instruction)}
        >
          Послушать
        </button>
      )}
      <p>{view.instruction}</p>
    </div>
  );
  if (view.kind === 'info')
    return (
      <article className="curriculum-step">
        {instruction}
        <div className="curriculum-material">
          {view.texts.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
        {sound && (
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const text = await controller.informationAudio();
                speak(text);
              })
            }
          >
            Послушать объяснение
          </button>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={() => act(() => controller.acknowledge(view.planId))}
        >
          Продолжить
        </button>
      </article>
    );
  if (
    ![
      'read',
      'choice',
      'compose',
      'boundary',
      'find_part',
      'transform',
      'passage',
      'read_meaning',
    ].includes(view.taskKind)
  )
    return (
      <article className="curriculum-step">
        <p role="alert">
          Этот вид задания пока не поддерживается. Шаг сохранён и не засчитан.
        </p>
      </article>
    );
  const submit = async (
    response: Parameters<CurriculumController['answer']>[0]['response'],
  ) =>
    run(async () => {
      const saved = await controller.answer({
        instanceId: view.instanceId,
        response,
      });
      const receipt = saved.profile.receipts[view.instanceId];
      if (receipt) onResult(receipt.outcome);
    });
  return (
    <article className="curriculum-step" key={view.instanceId}>
      {instruction}
      {view.taskInstruction !== view.instruction && (
        <p className="curriculum-task-instruction">{view.taskInstruction}</p>
      )}
      <div className="curriculum-material">
        <p>{view.text}</p>
      </div>
      <TaskRenderer
        task={view}
        busy={busy}
        onSubmit={submit}
        onReading={(reading) =>
          run(() => controller.recordReading(view.instanceId, reading))
        }
        onReveal={() => run(() => controller.revealOptions())}
        onSpeak={
          sound
            ? (questionId, optionId) =>
                act(async () => {
                  const text = await controller.optionAudio(
                    view.instanceId,
                    questionId,
                    optionId,
                  );
                  speak(text);
                })
            : undefined
        }
      />
      <div className="curriculum-help">
        {view.canShowIllustration && !view.illustration && (
          <button
            disabled={busy}
            onClick={() => act(() => controller.illustration(view.instanceId))}
          >
            Показать картинку-подсказку
          </button>
        )}
        {view.illustration && (
          <CurriculumIllustration
            asset={view.illustration}
            busy={busy}
            onVariant={(variant) =>
              act(() => controller.illustration(view.instanceId, variant))
            }
          />
        )}
        {sound && (
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const current = await controller.help({
                  level: view.mode === 'listen' ? 0 : 1,
                  targetAudio: true,
                });
                if (current?.kind === 'task') speak(current.text);
              })
            }
          >
            Послушать материал
          </button>
        )}
        <button
          disabled={busy || !view.canRequestHint}
          onClick={() => act(() => controller.hint(view.hints.length))}
        >
          Подсказка
        </button>
        {view.hints.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
      <div className="curriculum-actions">
        {(['uncertain', 'skipped', 'input_error'] as const).map(
          (disposition, i) => (
            <button
              key={disposition}
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await controller.answer({
                    instanceId: view.instanceId,
                    disposition,
                  });
                  onResult(disposition);
                })
              }
            >
              {['Не удалось оценить', 'Пропустить', 'Ошибка управления'][i]}
            </button>
          ),
        )}
      </div>
    </article>
  );
}
