import { useState } from 'react';
import type { CustomRoute, Supply } from '../../lib/curriculum/types.js';
import type { Mode, Outcome } from '../../lib/curriculum/contracts.js';
import type { CurriculumController } from '../curriculum/controller.js';
import { CurriculumStep } from '../curriculum/CurriculumStep.js';
import { useCurriculumSession } from '../curriculum/use-curriculum-session.js';
import { useInstructionAudio } from '../curriculum/use-instruction-audio.js';
import TrainerSetup from './TrainerSetup.js';
import type { TrainerSection } from './task-section';
import { trainerDefinitions, trainerItems, type TrainerId } from './catalog.js';
import {
  createTrainerRoute,
  nextTrainerTask,
  trainerRoutePrefix,
} from './session-actions.js';
const outcomeLabels: Record<Outcome, string> = {
  correct: 'Получилось!',
  incorrect: 'В этот раз не получилось. Можно попробовать другое задание.',
  uncertain: 'Ответ не оценён.',
  skipped: 'Задание пропущено.',
  input_error: 'Отмечена ошибка управления.',
};
export default function TrainerSession({
  controller,
  supply,
  trainerId,
  sound,
  speak,
  onExit,
  exitLabel = 'Все тренажёры',
  section,
  title: requestedTitle,
}: {
  controller: CurriculumController;
  supply: Supply;
  trainerId: TrainerId;
  sound: boolean;
  speak: (text: string) => void;
  onExit: () => void;
  exitLabel?: string;
  section?: TrainerSection;
  title?: string;
}) {
  const session = useCurriculumSession(controller);
  const { state, view, busy, error, run, act } = session;
  const prefix = trainerRoutePrefix(trainerId);
  const definition = trainerDefinitions.find((item) => item.id === trainerId)!;
  const items = trainerItems(supply, trainerId, section);
  const eligibleIds = new Set(items.map((item) => item.id));
  const title = requestedTitle ?? definition.title;
  const [routeId, setRouteId] = useState(() => {
    const saved = controller.snapshot();
    return saved.studyMode === 'custom' &&
      saved.route?.routeId.startsWith(prefix) &&
      saved.customRoutes[saved.route.routeId]?.steps.every((step) =>
        eligibleIds.has(step.itemId),
      )
      ? saved.route.routeId
      : null;
  });
  const [feedback, setFeedback] = useState('');
  const route = routeId ? state.customRoutes[routeId] : undefined;
  const complete = !!route && route.position >= route.steps.length;
  const active =
    route && state.studyMode === 'custom' && state.route?.routeId === routeId;
  const unfinished = Object.values(state.customRoutes)
    .filter(
      (item) =>
        item.routeId.startsWith(prefix) && item.position < item.steps.length,
    )
    .at(-1);
  const budget = (route?.steps.length ?? 5) as 3 | 5 | 7;
  const visible = active && state.profile.activeInstance ? view : null;
  const preferences = state.onboarding.questionnaire;
  const materialSound = sound && preferences.audioUsable !== false;
  const instructionSound =
    materialSound && preferences.instructionAudio !== 'off';
  useInstructionAudio(
    visible,
    instructionSound && preferences.instructionAudio === 'always',
    speak,
  );
  // Staged tasks can emit multiple answer events but have only one final receipt.
  const answeredIds = route
    ? [
        ...new Set(
          state.sourceEvents
            .filter(
              (event) =>
                event.routeId === route.routeId &&
                event.kind === 'answer' &&
                event.instanceId,
            )
            .map((event) => event.instanceId!),
        ),
      ]
    : [];
  const receipts = answeredIds
    .map((id) => state.profile.receipts[id])
    .filter(Boolean);
  const lastOutcome = receipts.at(-1)?.outcome;
  async function start(itemIds: string[], mode: Mode, length: 3 | 5 | 7) {
    const next = createTrainerRoute(trainerId, itemIds, mode);
    // Registration is durable before selection; a failed later save can be resumed.
    await controller.registerCustomRoute(next);
    await controller.selectCustomRoute(next.routeId);
    setRouteId(next.routeId);
    setFeedback('');
    await nextTrainerTask(controller, length);
  }
  async function resume(saved: CustomRoute) {
    await controller.selectCustomRoute(saved.routeId);
    setRouteId(saved.routeId);
    setFeedback('');
    await nextTrainerTask(controller, saved.steps.length as 3 | 5 | 7);
  }
  return (
    <section
      className="trainer-session curriculum-session"
      aria-label={title}
      aria-busy={busy}
    >
      <header className="curriculum-session-header">
        <button
          disabled={busy}
          onClick={() =>
            act(async () => {
              await controller.leaveSession();
              onExit();
            })
          }
        >
          {exitLabel}
        </button>
        <h1>{title}</h1>
        <p>{definition.description}</p>
      </header>
      {error && (
        <div role="alert" className="curriculum-save-error">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await controller.refresh();
                const saved = controller.snapshot();
                if (
                  saved.studyMode === 'custom' &&
                  saved.route?.routeId.startsWith(prefix)
                )
                  setRouteId(saved.route.routeId);
              })
            }
          >
            Перечитать сохранение
          </button>
        </div>
      )}
      {!route && (
        <>
          {unfinished && (
            <section className="curriculum-step">
              <h2>Есть незавершённое занятие</h2>
              {section &&
                !unfinished.steps.every((step) =>
                  eligibleIds.has(step.itemId),
                ) && (
                  <p>
                    Это ранее начатый набор с заданиями другого раздела. Можно
                    продолжить его или начать новый ниже.
                  </p>
                )}
              <p>
                Пройдено заданий: {unfinished.position} из{' '}
                {unfinished.steps.length}.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => act(() => resume(unfinished))}
              >
                Продолжить занятие
              </button>
            </section>
          )}
          <TrainerSetup
            items={items}
            busy={busy}
            onStart={(ids, mode, length) => act(() => start(ids, mode, length))}
          />
        </>
      )}
      {route && (
        <div className="curriculum-session-progress" role="status">
          Пройдено заданий: {route.position} из {route.steps.length}
        </div>
      )}
      {visible && (
        <CurriculumStep
          key={visible.kind === 'task' ? visible.instanceId : visible.planId}
          view={visible}
          controller={controller}
          busy={busy}
          sound={materialSound}
          instructionSound={instructionSound}
          speak={speak}
          run={run}
          onResult={(outcome) => setFeedback(outcomeLabels[outcome])}
        />
      )}
      {route && !visible && !complete && (
        <section className="curriculum-step">
          <p role="status">
            {feedback ||
              (lastOutcome
                ? outcomeLabels[lastOutcome]
                : 'Занятие сохранено. Можно продолжить.')}
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                if (!active) await controller.selectCustomRoute(route.routeId);
                await nextTrainerTask(controller, budget);
                setFeedback('');
              })
            }
          >
            Следующее задание
          </button>
        </section>
      )}
      {complete && (
        <section
          className="trainer-result curriculum-step"
          aria-label="Итог занятия"
        >
          <h2>Занятие завершено</h2>
          <p>Пройдено заданий: {route.steps.length}.</p>
          <p>
            Ответов принято:{' '}
            {receipts.filter((receipt) => receipt.outcome === 'correct').length}
            .
          </p>
          <p>Можно отдохнуть или позаниматься ещё.</p>
          <div className="curriculum-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                act(() =>
                  start(
                    route.steps.map((step) => step.itemId),
                    route.steps[0].mode,
                    budget,
                  ),
                )
              }
            >
              Повторить занятие
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setRouteId(null);
                setFeedback('');
              }}
            >
              Выбрать другой набор
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
