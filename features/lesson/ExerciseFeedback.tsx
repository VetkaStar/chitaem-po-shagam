import type { ExerciseModel } from './exercise-types';

import {
  Volume2,
  ArrowRight,
  Leaf,
  Check,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';

export default function ExerciseFeedback({
  feedback,
  mode,
  flyInputStatus,
  settings,
  speaking,
  speak,
  heard,
  target,
  typo,
  hint,
  picture,
  mistakes,
  setFeedback,
  setHeard,
  stop,
  setRest,
}: {
  feedback: ExerciseModel['feedback'];
  mode: ExerciseModel['mode'];
  flyInputStatus: ExerciseModel['flyInputStatus'];
  settings: ExerciseModel['settings'];
  speaking: ExerciseModel['speaking'];
  speak: ExerciseModel['speak'];
  heard: ExerciseModel['heard'];
  target: ExerciseModel['target'];
  typo: ExerciseModel['typo'];
  hint: ExerciseModel['hint'];
  picture: ExerciseModel['picture'];
  mistakes: ExerciseModel['mistakes'];
  setFeedback: ExerciseModel['setFeedback'];
  setHeard: ExerciseModel['setHeard'];
  stop: ExerciseModel['stop'];
  setRest: ExerciseModel['setRest'];
}) {
  // A hint line keeps its own speaker, like every other line of the task.
  const said = (text: string) => (
    <div className="said">
      {settings.sound && (
        <button
          className="speak-button"
          aria-label="Послушать подсказку"
          disabled={speaking}
          onClick={() => speak(text)}
        >
          <Volume2 size={18} />
        </button>
      )}
      <p>{text}</p>
    </div>
  );
  return (
    <>
      {heard && mode === 'read' && (
        <div className="comparison">
          <div>
            <small>Я услышал</small>
            <b>{heard}</b>
          </div>
          <ArrowRight />
          <div className="expected">
            <small>А здесь</small>
            <b>{target}</b>
          </div>
        </div>
      )}
      {typo && (
        <div className="typo-help" aria-label="Подсказка: исправление букв">
          <div>
            <small>Ты написал</small>
            <div className="typo-letters">
              {typo.cells.map((c, i) => (
                <span
                  key={i}
                  className={c.changed ? 'typo-mark' : ''}
                  aria-label={c.before || 'Место пропущенной буквы'}
                >
                  {c.before || '·'}
                </span>
              ))}
            </div>
          </div>
          <div>
            <small>Исправь так</small>
            <div className="typo-letters">
              {typo.cells.map((c, i) => (
                <span
                  key={i}
                  className={c.changed ? 'typo-fix' : ''}
                  aria-label={c.after || 'Убрать лишнюю букву'}
                >
                  {c.after || '·'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div
        className={'feedback ' + feedback.kind}
        role="status"
        aria-live="polite"
      >
        {mode !== 'fly' && settings.sound && (
          <button
            className="speak-button"
            aria-label="Озвучить объяснение"
            title="Озвучить объяснение"
            disabled={speaking}
            onClick={() => speak(feedback.text)}
          >
            <Volume2 size={18} />
          </button>
        )}
        {feedback.kind === 'success' ? (
          <Check size={19} />
        ) : feedback.kind === 'error' ? (
          <RotateCcw size={19} />
        ) : feedback.kind === 'uncertain' ? (
          <HelpCircle size={19} />
        ) : null}
        <span>{mode === 'fly' ? flyInputStatus : feedback.text}</span>
      </div>
      {mode !== 'fly' && (
        <div
          className="hint-space"
          data-visible={hint}
          aria-hidden={!hint}
          inert={!hint}
        >
          <div className="hint-box">
            {picture ? (
              <>
                {said(picture.hint)}
                <p className="hint-word">
                  Слово: <b>{target}</b>
                </p>
                <button
                  className="pill-button sample"
                  onClick={() => speak(target)}
                >
                  <Volume2 size={16} /> Послушать слово
                </button>
              </>
            ) : (
              <>
                {said(
                  mistakes >= 3
                    ? 'Найди такой же. Потом прочитай.'
                    : target.length > 1
                      ? 'Начни с первой буквы и соедини звуки.'
                      : 'Посмотри на букву. Повтори за взрослым.',
                )}
                <div className="sound-path">
                  {Array.from(target).map((c, i) => (
                    <span key={i}>
                      <b className={i === 0 ? 'first-focus' : ''}>{c}</b>
                      {i < target.length - 1 && <ArrowRight size={20} />}
                    </span>
                  ))}
                </div>
                {mistakes >= 2 && (
                  <button
                    className="pill-button sample"
                    onClick={() => speak(target.toLowerCase())}
                  >
                    <Volume2 size={16} /> Послушать вместе
                  </button>
                )}
                {mistakes >= 3 && target.length > 1 && (
                  <div className="support-choices">
                    {[
                      ...new Set([
                        Array.from(target).reverse().join(''),
                        target,
                      ]),
                    ].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          if (v === target) {
                            setFeedback({
                              kind: 'neutral',
                              text: `Да, это ${target}! Теперь прочитай.`,
                            });
                            setHeard('');
                            if (settings.sound && settings.autoSpeech)
                              speak(
                                `Да! ${target.toLowerCase()}. Теперь прочитай.`,
                              );
                          } else {
                            setFeedback({
                              kind: 'error',
                              text: `Посмотри: первая буква — ${target[0]}.`,
                            });
                          }
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
                {mistakes >= 3 && (
                  <button
                    className="link-button"
                    onClick={() => {
                      stop();
                      setRest(true);
                    }}
                  >
                    <Leaf size={16} /> Немного отдохнуть
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
