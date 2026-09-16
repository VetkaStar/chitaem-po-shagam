import { useEffect, useRef } from 'react';
import { Mic, Pause, Square, Volume2 } from 'lucide-react';
import ExerciseHeader from '../../components/exercise-header';
import TaskInstruction from '../../components/task-instruction';
import FeedbackMessage from '../../components/feedback-message';
import NextExerciseButton from '../../components/next-exercise-button';
import { TaskRenderer } from '../curriculum/TaskRenderer';
import type { TaskPresentation } from '../curriculum/presentation-types';
import type { PersonalView } from '../../lib/entry08/personal';
import type { EntryDispatch } from './entry-screen-types';

export interface PersonalLessonProps {
  view: PersonalView;
  busy?: boolean;
  capturing?: boolean;
  status?: string | null;
  error?: string | null;
  playingTarget?: boolean;
  number?: number;
  total?: number;
  dispatch: EntryDispatch;
  voiceEnabled?: boolean;
}

/** Safe learner projection only. Keys and the curriculum bank remain in the controller. */
export default function PersonalLesson({
  view: v,
  busy = false,
  capturing,
  status,
  error,
  playingTarget,
  number = 1,
  total = 1,
  dispatch,
  voiceEnabled = true,
}: PersonalLessonProps) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (v.kind === 'feedback') nextRef.current?.focus({ preventScroll: true });
  }, [v.kind, v.instanceId]);
  const answer = (kind: string, payload: Record<string, unknown> = {}) =>
    dispatch('personal_answer', { kind, ...payload });
  const projection = v as PersonalView & {
    answerKind?: TaskPresentation['answerKind'];
    joiner?: string;
    mode?: string;
    transformText?: string;
  };
  const task: TaskPresentation = {
    kind: 'task',
    instanceId: v.instanceId ?? '',
    taskKind: v.taskKind ?? 'read',
    instruction: v.instruction,
    taskInstruction: v.instruction,
    text: v.text,
    lines: v.lines,
    mode: projection.mode ?? 'read',
    answerKind: projection.answerKind ?? 'companion_reading',
    readingStageFinished: true,
    optionsRevealed: true,
    transformFollowup: false,
    options: v.options,
    questions: [],
    tokens: v.tokens,
    joiner: projection.joiner ?? '',
    selectedAnswers: {},
    helpLevel: v.assisted ? 1 : 0,
    hints: [],
    canRequestHint: false,
    functionCheck: null,
  };
  const feedback =
    v.result === 'correct'
      ? v.assisted
        ? 'Получилось с помощью. Продолжим!'
        : 'Верно! Получилось!'
      : v.result === 'incorrect'
        ? 'Попробуем ещё потренироваться.'
        : v.result === 'skipped'
          ? 'Пропустили. Продолжим.'
          : 'Продолжим заниматься.';
  const terminal = v.kind === 'pause' || v.kind === 'complete';
  return (
    <section
      className="entry08 personal08 lesson"
      aria-label="Моя дорожка"
      aria-busy={busy}
    >
      <header className="entry08-header">
        <p className="eyebrow">Моя дорожка</p>
        <h1>{v.title}</h1>
      </header>
      <div className="entry08-card">
        {!terminal && (
          <ExerciseHeader
            number={number}
            total={total}
            completed={Math.max(0, number - 1)}
          />
        )}
        <TaskInstruction
          text={v.instruction}
          sound
          speak={() => dispatch('personal_audio', { scope: 'instruction' })}
        />
        {!terminal && v.text && (
          <div className="entry08-target">
            {projection.transformText ?? v.text}
          </div>
        )}
        {v.hint && <p className="personal08-hint">{v.hint}</p>}
        {v.kind === 'feedback' ? (
          <>
            <FeedbackMessage
              kind={v.result === 'correct' ? 'success' : 'neutral'}
              text={feedback}
              sound
              speak={(text) => dispatch('feedback_audio', { text })}
            />
            <NextExerciseButton
              buttonRef={nextRef}
              disabled={busy}
              onNext={() => dispatch('personal_next')}
            />
          </>
        ) : v.kind === 'pause' ? (
          <div className="entry08-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => dispatch('personal_resume')}
            >
              Продолжить
            </button>
            <button onClick={() => dispatch('personal_finish')}>
              К тренажёрам
            </button>
          </div>
        ) : v.kind === 'complete' ? (
          <div className="entry08-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => dispatch('personal_continue')}
            >
              Продолжить дорожку
            </button>
            <button onClick={() => dispatch('personal_finish')}>
              К тренажёрам
            </button>
          </div>
        ) : (
          <>
            {v.audioAvailable && (
              <button
                className="entry08-listen"
                onClick={() =>
                  dispatch(
                    playingTarget ? 'personal_audio_stop' : 'personal_audio',
                    { scope: 'target' },
                  )
                }
              >
                {playingTarget ? <Square size={18} /> : <Volume2 size={18} />}
                {playingTarget
                  ? 'Остановить'
                  : v.phase === 'listen'
                    ? 'Послушать'
                    : 'Послушать пример'}
              </button>
            )}
            {v.kind === 'info' && (
              <button
                className="primary"
                disabled={busy || !v.canContinue}
                onClick={() => answer('info')}
              >
                Продолжить
              </button>
            )}
            {v.kind === 'task' && v.phase === 'read' && (
              <div className="entry08-actions">
                {voiceEnabled && (
                  <button
                    className="primary"
                    disabled={busy && !capturing}
                    onClick={() =>
                      dispatch(
                        capturing ? 'personal_mic_done' : 'personal_mic_start',
                      )
                    }
                  >
                    {capturing ? <Square size={20} /> : <Mic size={20} />}
                    {capturing
                      ? 'Готово'
                      : v.speechIssue && !v.speechIssue.retryable
                        ? 'Проверить микрофон'
                        : 'Ответить голосом'}
                  </button>
                )}
                <button disabled={busy} onClick={() => answer('unassessed')}>
                  Продолжить без оценки чтения
                </button>
              </div>
            )}
            {v.phase === 'question' && (
              <div className="entry08-choices">
                {v.options.map((option) => (
                  <div className="entry08-choice" key={option.id}>
                    <button
                      className="entry08-pick"
                      disabled={busy}
                      onClick={() =>
                        answer('choice', { optionIds: [option.id] })
                      }
                    >
                      {option.text}
                    </button>
                    <button
                      className="speak-button"
                      aria-label={'Послушать вариант: ' + option.text}
                      onClick={() =>
                        dispatch('personal_audio', {
                          scope: 'option',
                          optionId: option.id,
                        })
                      }
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {v.phase === 'answer' && (
              <TaskRenderer
                key={v.instanceId}
                task={task}
                busy={busy}
                compactControls
                compactAudio
                submitLabel="Проверить · Enter"
                onSubmit={async (response) =>
                  answer(v.taskKind ?? 'unassessed', {
                    ...response,
                    ...(response.text !== undefined
                      ? { value: response.text }
                      : {}),
                  })
                }
                onReading={async () => answer('unassessed')}
                onReveal={async () => {}}
              />
            )}
            <div className="entry08-actions personal08-footer">
              <button disabled={busy} onClick={() => answer('help')}>
                Подсказка
              </button>
              <button disabled={busy} onClick={() => answer('skip')}>
                Пропустить
              </button>
              <button onClick={() => dispatch('personal_pause')}>
                <Pause size={18} /> Пауза
              </button>
            </div>
          </>
        )}
        {v.speechIssue && (
          <p className="entry08-status" role="status">
            {v.speechIssue.message}
          </p>
        )}
        {status && !v.speechIssue && (
          <p className="entry08-status" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="entry08-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
