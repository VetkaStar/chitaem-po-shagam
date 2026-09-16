import {
  ArrowRight,
  HelpCircle,
  Mic,
  Pause,
  Square,
  Volume2,
} from 'lucide-react';
import FeedbackMessage from '../../components/feedback-message';
import TaskInstruction from '../../components/task-instruction';
import type { EntryScreensProps } from './entry-screen-types';

export default function EntryProbe({
  learner: v,
  companion,
  busy,
  capturing,
  playingTarget,
  played,
  dispatch,
}: EntryScreensProps) {
  if (!v) return <p role="status">Готовим задание…</p>;
  const answered = v.phase === 'feedback';
  return (
    <>
      <div className="entry08-tools">
        <button onClick={() => dispatch('how_answer')}>
          <HelpCircle size={18} /> Как ответить
        </button>
        <button onClick={() => dispatch('pause')}>
          <Pause size={18} /> Пауза
        </button>
      </div>
      <TaskInstruction
        text={v.instruction}
        sound
        speak={() => dispatch('instruction')}
      />
      {v.type !== 'listen' && <div className="entry08-target">{v.target}</div>}
      {!!v.helpParts?.length && (
        <p className="entry08-parts">{v.helpParts.join(' · ')}</p>
      )}
      {v.feedback && !v.speechIssue && (
        <FeedbackMessage
          kind="neutral"
          text={v.feedback}
          sound
          speak={(text) => dispatch('feedback_audio', { text })}
        />
      )}
      {v.speechIssue && (
        <FeedbackMessage
          kind="uncertain"
          text={v.speechIssue.message}
          sound
          speak={(text) => dispatch('feedback_audio', { text })}
        />
      )}
      {answered ? (
        <button
          className="primary"
          disabled={busy}
          onClick={() => dispatch('next')}
        >
          Дальше <ArrowRight size={18} />
        </button>
      ) : (
        <>
          {v.type === 'listen' &&
            ['listen', 'listening', 'question'].includes(v.phase ?? '') && (
              <button
                className="entry08-listen"
                onClick={() =>
                  dispatch(playingTarget ? 'audio_stop' : 'target_audio')
                }
              >
                {playingTarget ? <Square size={18} /> : <Volume2 size={18} />}
                {playingTarget
                  ? 'Остановить рассказ'
                  : played
                    ? 'Послушать рассказ ещё раз'
                    : 'Послушать рассказ'}
              </button>
            )}
          {v.phase === 'question' && (
            <div className="entry08-choices">
              {v.options?.map((option) => (
                <div className="entry08-choice" key={option.id}>
                  <button
                    className="entry08-pick"
                    disabled={busy}
                    onClick={() => dispatch('choose', { id: option.id })}
                  >
                    {option.text}
                  </button>
                  <button
                    className="speak-button"
                    aria-label={'Послушать вариант: ' + option.text}
                    onClick={() => dispatch('option_audio', { id: option.id })}
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {v.showMicrophone && (
            <button
              className="primary"
              disabled={busy && !capturing}
              onClick={() => dispatch(capturing ? 'mic_done' : 'mic_start')}
            >
              {capturing ? <Square size={20} /> : <Mic size={20} />}
              {capturing ? 'Готово' : 'Ответить голосом'}
            </button>
          )}
          {v.speechIssue && !v.speechIssue.retryable && (
            <div className="entry08-actions">
              <button onClick={() => dispatch('input', { value: 'buttons' })}>
                Отвечать нажатием
              </button>
              <button onClick={() => dispatch('mic_retry')}>
                Проверить микрофон
              </button>
            </div>
          )}
          {v.phase === 'read' && (
            <div className="entry08-actions">
              <button onClick={() => dispatch('target_audio')}>
                <Volume2 size={18} /> Послушать слово
              </button>
              <button disabled={busy} onClick={() => dispatch('help')}>
                Помоги
              </button>
            </div>
          )}
          <div className="entry08-actions">
            <button disabled={busy} onClick={() => dispatch('difficulty')}>
              Пока трудно
            </button>
            <button disabled={busy} onClick={() => dispatch('skip')}>
              Пропустить
            </button>
            <button onClick={() => dispatch('voice_options')}>
              Способ ответа
            </button>
          </div>
          {companion && v.phase === 'read' && (
            <details className="entry08-adult">
              <summary>Для взрослого</summary>
              <div className="entry08-actions">
                <button
                  disabled={busy}
                  onClick={() => dispatch('adult_result', { correct: true })}
                >
                  Прочитано верно
                </button>
                <button
                  disabled={busy}
                  onClick={() => dispatch('adult_result', { correct: false })}
                >
                  Нужна помощь с чтением
                </button>
              </div>
            </details>
          )}
        </>
      )}
    </>
  );
}
