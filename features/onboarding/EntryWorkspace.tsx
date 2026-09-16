import { useState } from 'react';
import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import type { CurriculumController } from '../curriculum/controller.js';
import { CurriculumStep } from '../curriculum/CurriculumStep.js';
import { entryPlanner } from '../../lib/curriculum/entry-planner.js';
import { useInstructionAudio } from '../curriculum/use-instruction-audio.js';
export interface EntryWorkspaceProps {
  state: ProgressState;
  supply: Supply;
  controller: CurriculumController;
  busy: boolean;
  sound: boolean;
  speak: (text: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
}
export default function EntryWorkspace({
  state,
  supply,
  controller,
  busy,
  sound,
  speak,
  run,
}: EntryWorkspaceProps) {
  const [observed, setObserved] = useState(false),
    [status, setStatus] = useState('');
  const flow = state.onboarding.entry!,
    cp = flow.checkpoints.find((c) => c.id === state.onboarding.checkpointId),
    view = controller.visible();
  useInstructionAudio(
    view,
    sound && state.onboarding.questionnaire.instructionAudio === 'always',
    speak,
  );
  const visit = state.profile.currentVisit,
    practice = flow.practice;
  const result = cp
    ? entryPlanner.groupStatus(supply.registry, cp.groupId, cp.observations)
    : null;
  const technical =
    cp &&
    cp.observations.length >= 2 &&
    cp.observations
      .slice(-2)
      .every((o) => ['uncertain', 'input_error'].includes(o.reason));
  const act = (fn: () => Promise<unknown>) => {
    void run(fn).catch(() => undefined);
  };
  const next = async () => {
    const token = await controller.planNext();
    if (['entry_task', 'entry_practice'].includes(token.kind)) {
      await controller.launch(token, crypto.randomUUID(), observed);
      setStatus('');
    } else setStatus(token.kind);
  };
  if (view)
    return (
      <section>
        {!practice && cp && (
          <label className="curriculum-companion">
            <input
              type="checkbox"
              disabled={busy}
              checked={
                cp.metadata[state.profile.activeInstance!.instanceId]
                  ?.onlyMemorised ?? false
              }
              onChange={(e) =>
                act(() =>
                  controller.markEntryMemorised(
                    state.profile.activeInstance!.instanceId,
                    e.target.checked,
                  ),
                )
              }
            />
            Взрослый заметил: эта запись узнаётся по памяти, самостоятельное
            чтение нового ещё не подтверждено
          </label>
        )}
        <CurriculumStep
          view={view}
          controller={controller}
          busy={busy}
          sound={sound}
          instructionSound={
            state.onboarding.questionnaire.instructionAudio !== 'off'
          }
          speak={speak}
          run={run}
          onResult={() => setStatus('')}
        />
        {!practice && (
          <button
            disabled={busy}
            onClick={() => act(() => controller.deferEntryCheck())}
          >
            Отложить проверку
          </button>
        )}
      </section>
    );
  if (practice && practice.position >= practice.plan.orderedTaskIds.length)
    return (
      <section className="curriculum-step">
        <p>
          Предварительная практика завершена. Входные навыки этим не
          подтверждаются.
        </p>
        <button
          disabled={busy}
          onClick={() => act(() => controller.finishEntryPractice())}
        >
          Вернуться к результатам
        </button>
      </section>
    );
  if (!practice && result && result.status !== 'pending')
    return (
      <section className="curriculum-step">
        <h2>Наблюдения сохранены</h2>
        <p>
          {result.status === 'pass'
            ? 'Задания этой группы получились.'
            : 'Для этой группы подберём обучение.'}
        </p>
        {result.canConfirm && (
          <button
            disabled={busy}
            onClick={() => act(() => controller.finishEntryGroup(true))}
          >
            Взрослый подтверждает наблюдения
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => act(() => controller.finishEntryGroup(false))}
        >
          Продолжить без подтверждения
        </button>
      </section>
    );
  if (
    !practice &&
    (technical || ['entry_unavailable', 'entry_deferred'].includes(status))
  )
    return (
      <section className="curriculum-step">
        <p>
          Сейчас проверку продолжить не получается. Это не означает, что навык
          отсутствует. Можно перейти к предварительной практике.
        </p>
        <button
          disabled={busy}
          onClick={() => act(() => controller.deferEntryCheck())}
        >
          Перейти к результатам
        </button>
      </section>
    );
  return (
    <section className="curriculum-step">
      <h2>
        {practice ? 'Предварительная практика' : 'Короткая входная проверка'}
      </h2>
      {!practice && (
        <p>
          Проверка помогает выбрать начало. Можно отложить её в любой момент.
        </p>
      )}
      {!visit ? (
        <button
          disabled={busy}
          onClick={() =>
            act(() =>
              controller.beginVisit(
                crypto.randomUUID(),
                state.onboarding.questionnaire.budget ?? 5,
              ),
            )
          }
        >
          Начать подход
        </button>
      ) : visit.actions >= visit.budget ? (
        <>
          <p>Пора сделать паузу. Продолжим с сохранённого места.</p>
          {!practice && (
            <button
              disabled={busy}
              onClick={() => act(() => controller.pauseEntryReport())}
            >
              Предварительные результаты
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => act(() => controller.endVisit())}
          >
            Закончить подход
          </button>
        </>
      ) : (
        <>
          {!practice && state.onboarding.questionnaire.companionAvailable && (
            <label className="curriculum-companion">
              <input
                type="checkbox"
                checked={observed}
                disabled={busy}
                onChange={(e) => setObserved(e.target.checked)}
              />
              Взрослый будет наблюдать следующий ответ
            </label>
          )}
          <button className="primary" disabled={busy} onClick={() => act(next)}>
            {practice ? 'Открыть задание' : 'Открыть следующую пробу'}
          </button>
        </>
      )}
      {!practice && (
        <button
          disabled={busy}
          onClick={() => act(() => controller.deferEntryCheck())}
        >
          Отложить проверку
        </button>
      )}
    </section>
  );
}
