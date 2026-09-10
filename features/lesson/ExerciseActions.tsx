import type { ExerciseModel } from './exercise-types';

import { Mic, MicOff, ArrowRight, Check } from 'lucide-react';

import type { RefObject } from 'react';

export default function ExerciseActions({
  feedback,
  nextButton,
  next,
  mode,
  listening,
  listen,
  supported,
  speaking,
  lessonMic,
  loadingSpeech,
  success,
  setFeedback,
  setHint,
  setMistakes,
  record,
  speak,
  target,
}: {
  feedback: ExerciseModel['feedback'];
  nextButton: RefObject<HTMLButtonElement | null>;
  next: ExerciseModel['next'];
  mode: ExerciseModel['mode'];
  listening: ExerciseModel['listening'];
  listen: ExerciseModel['listen'];
  supported: ExerciseModel['supported'];
  speaking: ExerciseModel['speaking'];
  lessonMic: ExerciseModel['lessonMic'];
  loadingSpeech: ExerciseModel['loadingSpeech'];
  success: ExerciseModel['success'];
  setFeedback: ExerciseModel['setFeedback'];
  setHint: ExerciseModel['setHint'];
  setMistakes: ExerciseModel['setMistakes'];
  record: ExerciseModel['record'];
  speak: ExerciseModel['speak'];
  target: ExerciseModel['target'];
}) {
  return (
    <>
      {feedback.kind === 'success' ? (
        <button
          ref={nextButton}
          className="primary"
          onClick={() => next()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.repeat) e.preventDefault();
          }}
        >
          Дальше · Enter <ArrowRight />
        </button>
      ) : mode === 'read' ? (
        <>
          <button
            className={'primary ' + (listening ? 'listening' : '')}
            onClick={listen}
            disabled={!supported || speaking}
          >
            {listening ? <MicOff /> : <Mic />}
            {lessonMic
              ? loadingSpeech
                ? 'Отменить подготовку'
                : 'Выключить микрофон'
              : 'Начать урок с микрофоном'}
          </button>
          {!supported && (
            <p className="heard">
              Микрофон здесь недоступен. Можно прочитать взрослому.
            </p>
          )}
          <details className="adult-check">
            <summary>Проверить вместе со взрослым</summary>
            <p>Послушайте ребёнка и выберите результат.</p>
            <div className="adult-actions">
              <button
                onClick={() => {
                  success('adult');
                }}
              >
                <Check /> Получилось
              </button>
              <button
                onClick={() => {
                  setFeedback({
                    kind: 'uncertain',
                    text: 'Давай вместе. Послушай и повтори.',
                  });
                  setHint(true);
                  setMistakes((n) => Math.max(2, n));
                  record('help', 'adult');
                  speak(target.toLowerCase());
                }}
              >
                Нужна помощь
              </button>
            </div>
          </details>
        </>
      ) : (
        <p className="keyboard-tip">Enter — проверить ответ</p>
      )}
    </>
  );
}
