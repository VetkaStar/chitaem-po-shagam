import { useEffect, useRef, useState } from 'react';
import ExerciseHeader from '../../components/exercise-header';
import type { LessonModel } from '../lesson/use-lesson';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { useCurriculumSession } from '../curriculum/use-curriculum-session';
import AnswerCard from './AnswerCard';
import { openAnswer, nextAnswer } from './session';
import { useInstructionAudio } from '../curriculum/use-instruction-audio';
import type { AnswerSection } from './types';

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
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    act(() => start());
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
  useInstructionAudio(
    current,
    sound && !blocked && preferences.instructionAudio === 'always',
    model.speak,
  );
  useEffect(() => {
    if (ready && route && !current && !blocked)
      nextButton.current?.focus({ preventScroll: true });
  }, [ready, current?.instanceId, route?.position, blocked]);
  useEffect(() => {
    model.setExternalActivity(!!current);
    if (current) model.schedule.touch();
    return () => model.setExternalActivity(false);
  }, [!!current]);
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
        <div className="exercise" aria-busy="true">
          <p role="status">Готовим вопрос…</p>
        </div>
      )}
      {ready && !route && (
        <div className="exercise">
          <p>
            В этой теме пока нет вопросов. Можно выбрать другую тему или режим.
          </p>
        </div>
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
          number={route.position + 1}
          total={route.steps.length}
          completed={route.position}
          color={model.settings.color}
          onActivity={model.schedule.touch}
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
            (feedback === 'correct' ? 'success' : 'neutral')
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
                : feedback === 'correct'
                  ? 'Верно!'
                  : feedback === 'skipped'
                    ? 'Задание пропущено'
                    : 'Можно потренироваться ещё'}
            </h2>
            {complete && (
              <p>Пройдено заданий: {route.position}. Теперь можно отдохнуть.</p>
            )}
            {complete && route.steps.length < model.settings.length && (
              <p>
                Все вопросы этой темы пройдены. В следующих темах появятся
                новые.
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
                  else await nextAnswer(controller);
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
