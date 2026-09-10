import type { ExerciseModel } from './exercise-types';

export default function ExerciseVoiceMonitor({
  mode,
  lessonMic,
  feedback,
  listening,
  speaking,
  cooldown,
  spectrum,
  loadingSpeech,
  attemptStatus,
  micLevel,
  speechProgress,
  target,
}: {
  mode: ExerciseModel['mode'];
  lessonMic: ExerciseModel['lessonMic'];
  feedback: ExerciseModel['feedback'];
  listening: ExerciseModel['listening'];
  speaking: ExerciseModel['speaking'];
  cooldown: ExerciseModel['cooldown'];
  spectrum: ExerciseModel['spectrum'];
  loadingSpeech: ExerciseModel['loadingSpeech'];
  attemptStatus: ExerciseModel['attemptStatus'];
  micLevel: ExerciseModel['micLevel'];
  speechProgress: ExerciseModel['speechProgress'];
  target: ExerciseModel['target'];
}) {
  return (
    <>
      {mode === 'read' && lessonMic && (
        <div
          className={
            'voice-orbit ' +
            (feedback.kind === 'success' ? 'voice-success' : '')
          }
        >
          <div
            className="equalizer"
            role="img"
            aria-label={
              listening && !speaking && !cooldown
                ? 'Микрофон слушает'
                : 'Микрофон ждёт'
            }
          >
            {spectrum.map((v, i) => (
              <i
                key={i}
                style={{
                  height: `${8 + (speaking || cooldown || feedback.kind === 'success' ? 0 : v) * 48}px`,
                }}
              />
            ))}
          </div>
          <span>
            {loadingSpeech
              ? 'Готовлю микрофон…'
              : feedback.kind === 'success'
                ? 'Получилось!'
                : speaking
                  ? 'Послушай подсказку'
                  : cooldown
                    ? 'Попробуем ещё раз'
                    : attemptStatus ||
                      (micLevel > 0.025 ? 'Слышу звук' : 'Я слушаю')}
          </span>
        </div>
      )}
      {mode === 'read' && speechProgress > 0 && feedback.kind !== 'success' && (
        <div className="slow-progress" aria-label="Услышанная часть слова">
          {Array.from(target).map((letter, i) => (
            <span key={i} className={i < speechProgress ? 'heard-letter' : ''}>
              {letter}
            </span>
          ))}
          <small>Продолжай с выделенной границы — я жду.</small>
        </div>
      )}
    </>
  );
}
