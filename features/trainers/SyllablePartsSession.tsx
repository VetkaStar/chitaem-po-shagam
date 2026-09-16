import type { TaskPresentation } from '../curriculum/presentation';
import type { Outcome } from '../../lib/curriculum/contracts';
import { useEffect, useRef, useState } from 'react';
import ExerciseHeader from '../../components/exercise-header';
import type { LessonModel } from '../lesson/use-lesson';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { useCurriculumSession } from '../curriculum/use-curriculum-session';
import { useInstructionAudio } from '../curriculum/use-instruction-audio';
import SyllablePartsCard from './SyllablePartsCard';
import {
  openSyllableParts,
  type SyllablePartsKind,
} from './syllable-parts-session';
import { nextTrainerTask } from './session-actions';
export default function SyllablePartsSession({
  controller,
  supply,
  model,
  kind,
  onBusyChange,
}: {
  controller: CurriculumController;
  supply: Supply;
  model: LessonModel;
  kind: SyllablePartsKind;
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
      await openSyllableParts(
        controller,
        supply,
        kind,
        model.settings.unit,
        model.settings.length,
        fresh,
      ),
    );
    setResult(null);
    setSummary(false);
    setReady(true);
  };
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    act(() => start());
  }, []);
  useEffect(() => {
    onBusyChange?.(busy || (!ready && !error));
  }, [busy, ready, error, onBusyChange]);
  const route = routeId ? state.customRoutes[routeId] : undefined;
  const offset = Number(route?.routeId.match(/:offset-(\d+):/)?.[1] ?? 0);
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
      const id = `syllable-parts:${kind}:${model.settings.unit}:repeat-0:offset-${offset + result.position}:${crypto.randomUUID()}`;
      const copy = {
        ...route,
        routeId: id,
        position: 0,
        suspendedInstance: null,
        steps: route.steps.slice(result.position).map((step, index) => ({
          ...step,
          id: `${id}:${index}`,
        })),
      };
      await controller.registerCustomRoute(copy);
      await controller.selectCustomRoute(id);
      await nextTrainerTask(controller, 7);
      setRouteId(id);
      setResult(null);
    });
  useInstructionAudio(
    current,
    sound && !blocked && preferences.instructionAudio === 'always',
    model.speak,
  );
  useEffect(() => {
    model.setExternalActivity(!!current);
    if (current) model.schedule.touch();
    return () => model.setExternalActivity(false);
  }, [!!current]);
  useEffect(() => {
    if (ready && route && !current && !blocked)
      nextButton.current?.focus({ preventScroll: true });
  }, [ready, current?.instanceId, route?.position, blocked]);
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
        <div className="exercise answer-result" aria-busy="true">
          <p role="status">Готовим задание…</p>
        </div>
      )}
      {ready && !route && (
        <div className="exercise answer-result">
          <p>
            В этой теме пока нет таких заданий. Можно выбрать другую тему или
            режим.
          </p>
        </div>
      )}
      {(current || result) && route && !summary && (
        <SyllablePartsCard
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
              !route.routeId.includes(`:repeat-${route.position}:`);
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
        <div className={'exercise answer-result neutral'}>
          <ExerciseHeader
            number={offset + Math.min(route.position + 1, route.steps.length)}
            total={offset + route.steps.length}
            completed={offset + route.position}
            label={complete ? 'Все задания пройдены' : undefined}
          />
          <div className="completion">
            <h2>
              {complete ? 'Ты позанимался. Здорово!' : 'Занятие сохранено'}
            </h2>
            {complete && (
              <p>
                Пройдено заданий: {offset + route.position}. Теперь можно
                отдохнуть.
              </p>
            )}
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
