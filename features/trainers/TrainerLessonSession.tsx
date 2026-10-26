import TaskCardBody from '@/features/lesson/TaskCardBody';
import type { TaskPresentation } from '../curriculum/presentation';
import type { Outcome } from '../../lib/curriculum/contracts';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import ExerciseHeader from '../../components/exercise-header';
import type { LessonModel } from '../lesson/use-lesson';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { useCurriculumSession } from '../curriculum/use-curriculum-session';
import { useInstructionAudio } from '../curriculum/use-instruction-audio';
import TrainerExerciseCard from './TrainerExerciseCard';
import {
  openTrainerLesson,
  lessonTrainerItems,
} from './trainer-lesson-session';
import AvailableTopic from '../../components/available-topic';
import { topicNames } from '../../lib/topics';
import type { TrainerId } from './catalog';
import type { TrainerSection } from './task-section';
import type { Mode } from '../../lib/curriculum/contracts';
import {
  nextTrainerTask,
  repeatTrainerTask,
  routeOffset,
  routeResults,
  stepWasCorrect,
} from './session-actions';
import SessionResults from '../../components/session-results';
export default function TrainerLessonSession({
  controller,
  supply,
  model,
  kind,
  section,
  mode = 'read',
  onBusyChange,
}: {
  controller: CurriculumController;
  supply: Supply;
  model: LessonModel;
  kind: TrainerId;
  section: TrainerSection;
  mode?: Mode;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { state, view, busy, error, run, act } =
    useCurriculumSession(controller);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  const [result, setResult] = useState<{
    view: TaskPresentation;
    position: number;
    outcome: Outcome;
    reward: boolean;
  } | null>(null);
  const [summary, setSummary] = useState(false);
  const nextButton = useRef<HTMLButtonElement>(null);
  const start = async (fresh = false) => {
    setRouteId(
      await openTrainerLesson(
        controller,
        supply,
        kind,
        section,
        model.settings.unit,
        model.settings.length,
        fresh,
        mode,
      ),
    );
    setResult(null);
    setSummary(false);
    setReady(true);
  };
  const initialize = useEffectEvent(() => act(() => start()));
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, []);
  useEffect(() => {
    onBusyChange?.(busy || (!ready && !error));
  }, [busy, ready, error, onBusyChange]);
  const route = routeId ? state.customRoutes[routeId] : undefined;
  const offset = route ? routeOffset(route) : 0;
  const complete = !!route && route.position >= route.steps.length;
  const current =
    route && state.route?.routeId === routeId && view?.kind === 'task'
      ? view
      : null;
  const blocked =
    busy || model.parent || model.rest || model.paused || model.speaking;
  const preferences = state.onboarding.questionnaire;
  const sound = model.settings.sound && preferences.audioUsable !== false;
  const next = () =>
    act(async () => {
      if (complete) {
        setResult(null);
        setSummary(true);
      } else {
        await nextTrainerTask(controller, 7);
        setResult(null);
      }
    });
  const repeat = () =>
    act(async () => {
      if (!route || !result) return;
      const id = await repeatTrainerTask(controller, route, result.position);
      setRouteId(id);
      setResult(null);
    });
  useInstructionAudio(
    current,
    sound && !blocked && preferences.instructionAudio === 'always',
    model.speak,
  );
  const active = !!current;
  const updateActivity = useEffectEvent((value: boolean) => {
    model.setExternalActivity(value);
    if (value) model.schedule.touch();
  });
  useEffect(() => {
    updateActivity(active);
    return () => updateActivity(false);
  }, [active]);
  useEffect(() => {
    if (ready && route && !current && !blocked)
      nextButton.current?.focus({ preventScroll: true });
  }, [ready, current, route, blocked]);
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
        <div className="exercise task-card answer-result" aria-busy="true">
          <p role="status">Готовим задание…</p>
        </div>
      )}
      {ready && !route && (
        <AvailableTopic
          available={topicNames.flatMap((_, unit) =>
            lessonTrainerItems(supply, kind, section, unit, mode).length
              ? [unit]
              : [],
          )}
          onSelect={(unit) => {
            model.stop();
            model.update('unit', unit);
          }}
        />
      )}
      {(current || result) && route && !summary && (
        <TrainerExerciseCard
          section={section}
          key={(current ?? result!.view).instanceId}
          view={current ?? result!.view}
          result={result?.outcome}
          rewarded={result?.reward}
          onNext={next}
          onRepeat={repeat}
          controller={controller}
          model={model}
          busy={blocked}
          sound={sound}
          instructionSound={sound && preferences.instructionAudio !== 'off'}
          speak={model.speak}
          run={run}
          position={offset + (result?.position ?? route.position)}
          total={offset + route.steps.length}
          onResult={(outcome) => {
            if (!current) return;
            const reward =
              outcome === 'correct' &&
              !stepWasCorrect(
                controller.snapshot(),
                route.steps[route.position].id,
                current.instanceId,
              );
            if (reward) model.awardTrainer(current.instanceId);
            setResult({
              view: current,
              position: route.position,
              outcome,
              reward,
            });
            model.schedule.touch();
            if (
              model.schedule.shouldRest(
                offset + route.position + 1,
                offset + route.steps.length,
              )
            )
              model.setRest(true);
          }}
        />
      )}
      {route && !current && !result && (
        <div className={'exercise task-card answer-result neutral'}>
          <ExerciseHeader
            number={offset + Math.min(route.position + 1, route.steps.length)}
            total={offset + route.steps.length}
            completed={offset + route.position}
            label={complete ? 'Занятие завершено' : undefined}
          />
          <TaskCardBody
            className="completion task-card-body"
            aria-label="Результат занятия"
          >
            <h2>
              {complete ? 'Ты позанимался. Здорово!' : 'Занятие сохранено'}
            </h2>
            {complete && <SessionResults {...routeResults(state, route)} />}
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
                  if (complete) await start(true);
                  else await nextTrainerTask(controller, 7);
                })
              }
            >
              {complete ? 'Ещё занятие' : 'Дальше · Enter'}
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
