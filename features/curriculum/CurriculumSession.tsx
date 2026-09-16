import { useState } from 'react';
import type { CurriculumController } from './controller.js';
import type { Outcome } from '../../lib/curriculum/contracts.js';
import { useCurriculumSession } from './use-curriculum-session.js';
import { CurriculumStep } from './CurriculumStep.js';
import { DemoControls } from './DemoControls.js';
import { useInstructionAudio } from './use-instruction-audio.js';
export interface CurriculumSessionProps {
  autoInstruction?: boolean;
  allowProgramSelection?: boolean;
  controller: CurriculumController;
  programs: { id: string; title: string }[];
  sound: boolean;
  instructionSound?: boolean;
  speak: (text: string) => void;
  onExit: () => void;
  onRoadmap?: () => void;
}
const outcomes: Record<Outcome, string> = {
  correct: 'Ответ принят.',
  incorrect: 'В этот раз не получилось. Продолжим с поддержкой.',
  uncertain: 'Ответ не оценён.',
  skipped: 'Задание пропущено.',
  input_error: 'Отмечена техническая ошибка.',
};
export default function CurriculumSession({
  controller,
  autoInstruction = false,
  allowProgramSelection = true,
  programs,
  sound,
  instructionSound = sound,
  speak,
  onExit,
  onRoadmap,
}: CurriculumSessionProps) {
  const session = useCurriculumSession(controller);
  const { state, view, busy, error, status, run, act, next, setStatus } =
    session;
  const [budget, setBudget] = useState<3 | 5 | 7>(5),
    [feedback, setFeedback] = useState('');
  useInstructionAudio(
    view,
    sound && instructionSound && autoInstruction,
    speak,
  );
  const visit = state.profile.currentVisit;
  const demoMethod =
    state.studyMode === 'demonstration' &&
    (state.route?.routeId === 'p1' || state.route?.routeId === 'p2')
      ? state.route.routeId
      : null;
  const demoComfort = demoMethod
    ? (state.demonstrationRuns?.[demoMethod]?.comfort ?? null)
    : null;
  const demoComplete = controller.demonstrationComplete();
  return (
    <section
      className="curriculum-session"
      aria-label="Учебная программа"
      aria-busy={busy}
    >
      <header className="curriculum-session-header">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            act(async () => {
              await controller.deferSetup();
              onExit();
            })
          }
        >
          Все тренажёры
        </button>
        <h1>Учебная программа</h1>
        {onRoadmap && (
          <button type="button" disabled={busy} onClick={onRoadmap}>
            Моя дорожка
          </button>
        )}
        {allowProgramSelection && (
          <label>
            Программа
            <select
              aria-label="Программа"
              value={
                state.studyMode === 'recommended'
                  ? (state.route?.routeId ?? '')
                  : ''
              }
              disabled={busy}
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  act(async () => {
                    await controller.selectProgram(id);
                    setFeedback('');
                    setStatus('');
                  });
              }}
            >
              <option value="" disabled>
                Выбери программу
              </option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="curriculum-session-progress" role="status">
        {visit
          ? 'Экраны занятия: ' + visit.actions + ' из ' + visit.budget
          : 'Занятие ещё не начато'}
      </div>
      <DemoControls
        method={demoMethod}
        comfort={demoComfort}
        completed={demoComplete}
        busy={busy}
        onSelect={(method) =>
          act(async () => {
            await controller.selectDemonstration(method);
            setFeedback('');
            setStatus('');
          })
        }
        onComfort={(comfort) =>
          act(async () => {
            await controller.saveDemoComfort(comfort);
          })
        }
      />
      {error && (
        <div role="alert" className="curriculum-save-error">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await controller.refresh();
                setFeedback('');
                setStatus('');
              })
            }
          >
            Перечитать сохранение
          </button>
        </div>
      )}
      {!visit && !view && !demoComplete && (
        <div className="curriculum-session-start">
          <label>
            Длина занятия
            <select
              aria-label="Длина занятия"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value) as 3 | 5 | 7)}
              disabled={busy}
            >
              <option value={3}>3 экрана</option>
              <option value={5}>5 экранов</option>
              <option value={7}>7 экранов</option>
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || state.studyMode === 'free'}
            onClick={() =>
              act(async () => {
                await controller.beginVisit(crypto.randomUUID(), budget);
                await next();
              })
            }
          >
            Начать занятие
          </button>
        </div>
      )}
      {view && (
        <CurriculumStep
          view={view}
          controller={controller}
          busy={busy}
          sound={sound}
          instructionSound={instructionSound}
          speak={speak}
          run={run}
          onResult={(outcome) => setFeedback(outcomes[outcome])}
        />
      )}
      {!view && visit && (
        <div className="curriculum-session-transition">
          {feedback && <p role="status">{feedback}</p>}
          {demoComplete ? (
            <p role="status">
              Демонстрация завершена. Можно попробовать другой способ или
              выбрать программу.
            </p>
          ) : status === 'pause' || visit.actions >= visit.budget ? (
            <>
              <p>
                На сегодня достаточно. Можно отдохнуть и начать новое занятие
                позже.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await controller.endVisit();
                    setStatus('');
                  })
                }
              >
                Завершить занятие
              </button>
            </>
          ) : status && status !== 'begin_visit' ? (
            <p role="status">
              {status === 'demonstration_complete'
                ? 'Знакомство с методом завершено. Можно отметить своё впечатление или попробовать другой способ.'
                : status === 'route_complete'
                  ? 'Программа завершена.'
                  : status === 'custom_complete'
                    ? 'Дорожка завершена.'
                    : 'Для продолжения нужен отдельный шаг настройки или поддержки. Результаты сохранены.'}
            </p>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() => act(next)}
            >
              Дальше
            </button>
          )}
        </div>
      )}
    </section>
  );
}
