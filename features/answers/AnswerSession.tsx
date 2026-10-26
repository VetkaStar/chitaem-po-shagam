import TaskCardBody from '@/features/lesson/TaskCardBody';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import ExerciseHeader from '../../components/exercise-header';
import type { LessonModel } from '../lesson/use-lesson';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { useCurriculumSession } from '../curriculum/use-curriculum-session';
import AnswerCard from './AnswerCard';
import { openAnswer, nextAnswer, answerItems } from './session';
import AvailableTopic from '../../components/available-topic';
import { topicNames } from '../../lib/topics';
import { useInstructionAudio } from '../curriculum/use-instruction-audio';
import type { AnswerSection } from './types';
import {
  repeatTrainerTask,
  routeOffset,
  routeResults,
  stepWasCorrect,
} from '../trainers/session-actions';
import SessionResults from '../../components/session-results';

export default function AnswerSession({
  controller,
  supply,
  model,
  section = 'words',
}: {
  controller: CurriculumController;
  supply: Supply;
  model: LessonModel;
  section?: AnswerSection;
}) {
  const { state, view, busy, error, run, act } =
    useCurriculumSession(controller);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  const start = async (fresh = false) => {
    const id = await openAnswer(
      controller,
      supply,
      model.settings.unit,
      model.settings.length,
      fresh,
      section,
    );
    setRouteId(id);
    setReady(true);
  };
  const initialize = useEffectEvent(() => act(() => start()));
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, []);
  const route = routeId ? state.customRoutes[routeId] : undefined;
  const complete = !!route && route.position >= route.steps.length;
  const current =
    route && state.route?.routeId === routeId && view?.kind === 'task'
      ? view
      : null;
  const outcome = route
    ? state.sourceEvents
        .filter((e) => e.routeId === routeId && e.kind === 'answer')
        .map((e) => e.instanceId && state.profile.receipts[e.instanceId])
        .filter(Boolean)
        .at(-1)
    : null;
  const preferences = state.onboarding.questionnaire;
  const sound = model.settings.sound;
  const blocked = busy || model.parent || model.rest || model.paused;
  const feedback =
    outcome && typeof outcome === 'object' ? outcome.outcome : undefined;
  const retry =
    feedback === 'incorrect' ||
    feedback === 'uncertain' ||
    feedback === 'input_error';
  const offset = route ? routeOffset(route) : 0;
  const repeat = async () => {
    if (!route) return;
    setRouteId(
      await repeatTrainerTask(
        controller,
        route,
        Math.max(0, route.position - 1),
      ),
    );
    const view = controller.visible();
    if (view?.kind === 'task' && !view.optionsRevealed)
      await controller.revealOptions();
  };
  useInstructionAudio(
    current,
    sound && !blocked && preferences.instructionAudio === 'always',
    model.speak,
  );
  useEffect(() => {
    if (ready && route && !current && !blocked)
      nextButton.current?.focus({ preventScroll: true });
  }, [ready, current, route, blocked]);
  const active = !!current;
  const updateActivity = useEffectEvent((value: boolean) => {
    model.setExternalActivity(value);
    if (value) model.schedule.touch();
  });
  useEffect(() => {
    updateActivity(active);
    return () => updateActivity(false);
  }, [active]);
  return (
    <>
      {error && (
        <div role="alert" className="storage-note">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await controller.refresh();
                await start();
              })
            }
          >
            Повторить попытку
          </button>
        </div>
      )}
      {!ready && (
        <div className="exercise task-card" aria-busy="true">
          <p role="status">Готовим вопрос…</p>
        </div>
      )}
      {ready && !route && (
        <AvailableTopic
          available={topicNames.flatMap((_, unit) =>
            answerItems(supply, unit, section).length ? [unit] : [],
          )}
          onSelect={(unit) => {
            model.stop();
            model.changeTopic(model.stage, unit);
          }}
        />
      )}
      {current && route && (
        <AnswerCard
          key={current.instanceId}
          view={current}
          section={section}
          controller={controller}
          busy={blocked}
          sound={sound}
          instructionSound={sound && preferences.instructionAudio !== 'off'}
          speak={model.speak}
          run={run}
          number={offset + route.position + 1}
          total={offset + route.steps.length}
          completed={offset + route.position}
          color={model.settings.color}
          onActivity={model.schedule.touch}
          onResult={(outcome) => {
            if (
              outcome === 'correct' &&
              !stepWasCorrect(
                controller.snapshot(),
                route.steps[route.position].id,
                current.instanceId,
              )
            )
              model.awardTrainer(current.instanceId);
            model.schedule.touch();
            if (
              model.schedule.shouldRest(route.position + 1, route.steps.length)
            )
              model.setRest(true);
          }}
        />
      )}
      {route && !current && (
        <div
          className={
            'exercise task-card answer-result ' +
            (feedback === 'correct' ? 'success' : 'neutral')
          }
        >
          <ExerciseHeader
            number={offset + Math.max(1, route.position)}
            total={offset + route.steps.length}
            completed={offset + route.position}
            label={complete && !retry ? 'Занятие завершено' : undefined}
          />
          <TaskCardBody
            className="completion task-card-body"
            aria-label="Результат задания"
          >
            <h2>
              {complete && !retry
                ? 'Ты позанимался. Здорово!'
                : feedback === 'correct'
                  ? 'Верно!'
                  : feedback === 'skipped'
                    ? 'Задание пропущено'
                    : 'Попробуем ещё раз'}
            </h2>
            {complete && !retry && (
              <SessionResults {...routeResults(state, route)} />
            )}
            {complete &&
              !retry &&
              offset + route.steps.length < model.settings.length && (
                <p>
                  Вопросы этой темы закончились. В следующих темах появятся
                  новые.
                </p>
              )}
          </TaskCardBody>
          <div className="task-card-actions">
            <button
              ref={nextButton}
              className="primary"
              disabled={blocked}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.repeat)
                  event.preventDefault();
              }}
              onClick={() =>
                act(async () => {
                  if (retry) await repeat();
                  else if (complete) await start(true);
                  else await nextAnswer(controller);
                })
              }
            >
              {retry
                ? 'Попробовать ещё раз · Enter'
                : complete
                  ? 'Ещё занятие'
                  : 'Дальше · Enter'}
            </button>
            {complete && (
              <button disabled={blocked} onClick={() => model.setRest(true)}>
                Отдохнуть
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
