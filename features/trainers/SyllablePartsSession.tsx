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
  const complete = !!route && route.position >= route.steps.length;
  const current =
    route && state.route?.routeId === routeId && view?.kind === 'task'
      ? view
      : null;
  const blocked = busy || model.parent || model.rest || model.paused;
  const preferences = state.onboarding.questionnaire;
  const sound = model.settings.sound && preferences.audioUsable !== false;
  const receipt = route
    ? state.sourceEvents
        .filter((e) => e.routeId === routeId && e.kind === 'answer')
        .map((e) => e.instanceId && state.profile.receipts[e.instanceId])
        .filter(Boolean)
        .at(-1)
    : null;
  const outcome =
    receipt && typeof receipt === 'object' ? receipt.outcome : undefined;
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
      {current && route && (
        <SyllablePartsCard
          key={current.instanceId}
          view={current}
          controller={controller}
          model={model}
          busy={blocked}
          sound={sound}
          instructionSound={sound && preferences.instructionAudio !== 'off'}
          speak={model.speak}
          run={run}
          position={route.position}
          total={route.steps.length}
          onResult={() => {
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
            'exercise answer-result ' +
            (outcome === 'correct' ? 'success' : 'neutral')
          }
        >
          <ExerciseHeader
            number={Math.min(route.position + 1, route.steps.length)}
            total={route.steps.length}
            completed={route.position}
            label={complete ? 'Все задания пройдены' : undefined}
          />
          <div className="completion">
            <h2>
              {complete
                ? 'Ты позанимался. Здорово!'
                : outcome === 'correct'
                  ? 'Верно!'
                  : outcome === 'skipped'
                    ? 'Задание пропущено'
                    : 'Можно потренироваться ещё'}
            </h2>
            {complete && (
              <p>Пройдено заданий: {route.position}. Теперь можно отдохнуть.</p>
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
