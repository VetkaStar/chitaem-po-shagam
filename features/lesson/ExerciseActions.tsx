import type { ExerciseModel } from './exercise-types';

import {
  ArrowRight,
  Check,
  HelpCircle,
  Leaf,
  Mic,
  MicOff,
  RefreshCw,
  RotateCcw,
  Users,
} from 'lucide-react';

import type { ReactNode, RefObject } from 'react';

/** Main action between two side buttons, plus quiet links.
 *  Laptop shows them under the task; tablet and phone move the buttons into a dock at the bottom edge. */
export default function ExerciseActions({
  done,
  countdown,
  continueCountdown,
  autoAdvanceStop,
  feedback,
  nextButton,
  next,
  mode,
  hint,
  canSubmit,
  submit,
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
  onRepeat,
  onOtherCards,
  onRest,
  onContinue,
}: {
  done: boolean;
  countdown?: ReactNode;
  continueCountdown?: ReactNode;
  autoAdvanceStop?: ReactNode;
  feedback: ExerciseModel['feedback'];
  nextButton: RefObject<HTMLButtonElement | null>;
  next: ExerciseModel['next'];
  mode: ExerciseModel['mode'];
  hint: ExerciseModel['hint'];
  canSubmit: boolean;
  submit: ExerciseModel['submit'];
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
  onRepeat: () => void;
  onOtherCards: () => void;
  onRest: () => void;
  onContinue: () => void;
}) {
  const side = (
    place: 'left' | 'right',
    icon: ReactNode,
    label: string,
    short: string,
    onClick: () => void,
    o: { selected?: boolean; after?: boolean; extra?: ReactNode } = {},
  ) => (
    <button
      type="button"
      className={`dock-side dock-${place}` + (o.selected ? ' selected' : '')}
      aria-label={label}
      onClick={onClick}
    >
      {!o.after && icon}
      <span className="label-long">{label}</span>
      <span className="label-short" aria-hidden="true">
        {short}
      </span>
      {o.after && icon}
      {o.extra}
    </button>
  );
  const hintToggle = side(
    'right',
    <HelpCircle />,
    hint ? 'Скрыть подсказку' : 'Подсказка',
    hint ? 'Скрыть' : 'Подсказка',
    () => setHint(!hint),
    { selected: hint },
  );
  const skip = (
    <button
      type="button"
      className="link-button skip-link"
      onClick={() => next(true)}
    >
      Пропустить <ArrowRight />
    </button>
  );
  let primary: ReactNode;
  let left: ReactNode = side(
    'left',
    <RotateCcw />,
    'Повторить задание',
    'Повторить',
    onRepeat,
  );
  let right: ReactNode = null;
  let links: ReactNode = null;
  let note: ReactNode = null;
  if (done) {
    primary = (
      <button className="primary" onClick={onRest}>
        <Leaf /> Отдохнуть
      </button>
    );
    left = null;
    right = side(
      'right',
      <ArrowRight />,
      'Следующее занятие',
      'Дальше',
      onContinue,
      {
        after: true,
        extra: continueCountdown,
      },
    );
  } else if (feedback.kind === 'success') {
    primary = (
      <button
        ref={nextButton}
        className="primary"
        onClick={() => next()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.repeat) e.preventDefault();
        }}
      >
        <span>
          Дальше<span className="key-hint"> · Enter</span>
        </span>{' '}
        <ArrowRight />
        {countdown}
      </button>
    );
  } else if (mode === 'read') {
    primary = (
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
    );
    right = hintToggle;
    links = (
      <>
        <details className="adult-check">
          <summary>
            <Users /> Проверить вместе со взрослым
          </summary>
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
        {skip}
      </>
    );
    if (!supported)
      note = (
        <p className="heard mic-unsupported">
          Микрофон здесь недоступен. Можно прочитать взрослому.
        </p>
      );
  } else {
    primary = (
      <button className="primary" onClick={submit} disabled={!canSubmit}>
        <Check /> {mode === 'fly' ? 'Поймать' : 'Проверить'}
      </button>
    );
    right =
      mode === 'fly'
        ? side(
            'right',
            <RefreshCw />,
            'Другие карточки',
            'Другие',
            onOtherCards,
          )
        : hintToggle;
    links = mode === 'fly' ? null : skip;
  }
  return (
    <div className="lesson-actions">
      <div className="lesson-dock">
        {primary}
        {left ?? <span className="dock-spacer dock-left" aria-hidden="true" />}
        {right ?? (
          <span className="dock-spacer dock-right" aria-hidden="true" />
        )}
      </div>
      {autoAdvanceStop}
      {links && <div className="lesson-links">{links}</div>}
      {note}
    </div>
  );
}
