'use client';
import { illustrationSources } from '@/content/illustration-sources';
import { illustrationSizes, useIllustrationPreload } from '@/components/use-illustration-preload';
import ExerciseHeader from '@/components/exercise-header';
import PracticeMenu from '@/components/practice-menu';
import type { ReactNode } from 'react';
import AutoAdvanceSettings from '@/components/auto-advance-settings';
import AutoAdvance from '@/components/auto-advance';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MessageCircle,
  Keyboard,
  Volume2,
  RotateCcw,
} from 'lucide-react';
import type { ReadingText } from '@/content/reading-library';
import type { LessonModel } from '../lesson/use-lesson';
import { shuffled } from '@/lib/session';
import { checkTextWriting, readingLetters } from '@/lib/text-practice';
import ReadingGuide from '../lesson/ReadingGuide';
import ReadingGuideControls from '../lesson/ReadingGuideControls';
import { letterOffset, firstUnreadSource } from '@/lib/reading-guide';
import { useTextMicrophone } from './use-text-microphone';
import TaskInstruction from '@/components/task-instruction';
import { guideParts } from '@/lib/reading-guide';
import './text-practice.css';
import IllustrationGallery from '@/components/illustration-gallery';
import { textIllustrations } from '@/content/illustrations';
type Mode = 'read' | 'questions' | 'write';
export default function TextExercise({
  micSession,
  textPicker,
  item,
  model,
  onBack,
  onNext,
  onComplete,
  taskNumber = 1,
  taskTotal = 1,
  completedTasks = 0,
}: {
  micSession?: { current: boolean };
  textPicker?: ReactNode;
  item: ReadingText;
  model: LessonModel;
  onBack: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  taskNumber?: number;
  taskTotal?: number;
  completedTasks?: number;
}) {
  useIllustrationPreload(textIllustrations[item.id], item.lineIllustrations);
  const [mode, setMode] = useState<Mode>('read'),
    [ask, setAsk] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [line, setLine] = useState(0),
    [accepted, setAccepted] = useState(false),
    [question, setQuestion] = useState(false),
    [done, setDone] = useState(false);
  const [answer, setAnswer] = useState(''),
    [attempts, setAttempts] = useState(0),
    [message, setMessage] = useState(''),
    [mic, setMicState] = useState(micSession?.current ?? false);
  function setMic(value: boolean | ((previous: boolean) => boolean)) {
    setMicState(previous => {
      const next = typeof value === 'function' ? value(previous) : value;
      if (micSession) micSession.current = next;
      return next;
    });
  }
  const [readStart, setReadStart] = useState(0);
  const [readLines, setReadLines] = useState<number[]>([]);
  const covered = useRef(new Set<number>());
  const [selectionEpoch, setSelectionEpoch] = useState(0);
  const [hint, setHint] =
    useState<ReturnType<typeof checkTextWriting>['hint']>();
  const awarded = useRef(new Set<string>()),
    nextButton = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const options = useMemo(() => shuffled(item.options), [item]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('reading-text-options-v1') || '{}',
      );
      if (['read', 'questions', 'write'].includes(saved.mode))
        setMode(saved.mode);
      setAsk(saved.ask === true);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(
          'reading-text-options-v1',
          JSON.stringify({ mode, ask }),
        );
      } catch {}
    }
  }, [mode, ask, loaded]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setMic(false);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      model.stop();
    };
  }, []);
  useEffect(() => {
    if (accepted) nextButton.current?.focus({ preventScroll: true });
    else if (mode === 'write') input.current?.focus({ preventScroll: true });
  }, [accepted, mode, line]);
  function finish() {
    setDone(true);
    onComplete?.();
    setMessage('Молодец! Задание выполнено.');
    if (!awarded.current.has(mode)) {
      awarded.current.add(mode);
      model.awardReadingText(item.id + ':' + mode, item.title, mode);
    }
  }
  const speech = useTextMicrophone(
    item.lines[line].slice(readStart),
    readStart + ':' + selectionEpoch + ':' + item.id + ':' + mode + ':' + line,
    mic &&
      mode === 'read' &&
      !accepted &&
      !question &&
      !done &&
      !model.parent &&
      !model.paused &&
      !model.rest &&
      !model.speaking &&
      model.settings.micConsent,
    model.settings.micDevice,
    () => {
      const start = letterOffset(item.lines[line], readStart);
      for (let i = start; i < readingLetters(item.lines[line]).length; i++)
        covered.current.add(i);
      const missing = firstUnreadSource(item.lines[line], covered.current);
      if (missing !== null) {
        setReadStart(missing);
        setSelectionEpoch((n) => n + 1);
        setMessage('Эта часть прочитана! Теперь прочитаем пропущенное начало.');
      } else {
        setAccepted(true);
        setReadLines((v) => [...new Set([...v, line])]);
        setMessage('Строка прочитана!');
      }
    },
    () => {
      setMic(false);
      model.setPaused(true);
    },
  );
  useEffect(() => {
    const start = letterOffset(item.lines[line], readStart);
    for (let i = start; i < start + speech.progress; i++)
      covered.current.add(i);
    if (
      speech.progress > 0 &&
      !accepted &&
      firstUnreadSource(item.lines[line], covered.current) === null
    ) {
      setAccepted(true);
      setReadLines((v) => [...new Set([...v, line])]);
      setMessage('Строка прочитана!');
    }
  }, [speech.progress, line, readStart, accepted]);
  useEffect(() => {
    if (
      model.settings.textFlow !== 'auto' ||
      mode !== 'read' ||
      !accepted ||
      done ||
      question ||
      model.parent ||
      model.paused ||
      model.rest ||
      model.speaking
    )
      return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      if (!document.hidden)
        timer = setTimeout(() => {
          if (!document.hidden) next();
        }, 600);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [
    accepted,
    done,
    question,
    line,
    mode,
    model.settings.textFlow,
    model.parent,
    model.paused,
    model.rest,
    model.speaking,
  ]);
  function choosePart(source: number) {
    setReadStart(source);
    setSelectionEpoch((n) => n + 1);
    setAccepted(false);
    setMessage('Читай с выбранного места. Все части строки нужно прочитать.');
  }
  function chooseLine(index: number) {
    setLine(index);
    setReadStart(0);
    setSelectionEpoch((n) => n + 1);
    covered.current.clear();
    setAccepted(readLines.includes(index));
    setMessage('');
  }
  function changeMode(value: Mode) {
    if (value === mode) return;
    model.stop();
    setMic(false);
    setMode(value);
    setLine(0);
    setReadStart(0);
    setReadLines([]);
    covered.current.clear();
    setAccepted(false);
    setQuestion(false);
    setDone(false);
    setAnswer('');
    setAttempts(0);
    setHint(undefined);
    setMessage('');
  }
  function repeatExercise() {
    model.stop();
    setSelectionEpoch((n) => n + 1);
    setReadStart(0);
    covered.current.clear();
    if (!question && mode !== 'questions')
      setReadLines((lines) => lines.filter((i) => i !== line));
    setAccepted(false);
    setDone(false);
    setAnswer('');
    setAttempts(0);
    setHint(undefined);
    setMessage('Попробуем это задание ещё раз.');
  }
  function next() {
    if (!accepted) return;
    const unreadLine =
      mode === 'read'
        ? item.lines.findIndex((_, i) => !readLines.includes(i))
        : line + 1;
    if (mode === 'read' ? unreadLine >= 0 : line + 1 < item.lines.length) {
      setLine(mode === 'read' ? unreadLine : line + 1);
      setReadStart(0);
      covered.current.clear();
      setSelectionEpoch((n) => n + 1);
      setAccepted(false);
      setAnswer('');
      setAttempts(0);
      setHint(undefined);
      setMessage('');
    } else if (mode === 'read' && ask) {
      setQuestion(true);
      setMessage('Текст прочитан. Теперь ответь на вопрос.');
    } else finish();
  }
  function check() {
    if (accepted) {
      next();
      return;
    }
    if (!answer.trim()) return;
    const result = checkTextWriting(answer, item.lines[line], attempts + 1);
    setAttempts((n) => n + 1);
    setMessage(result.message);
    setHint(result.hint);
    if (result.correct) setAccepted(true);
  }
  const showQuestion = mode === 'questions' || question;
  return (
    <>
      <div className="lesson-controls">
        <div
          className="mode-list text-mode-list"
          role="group"
          aria-label="Режим работы с текстом"
        >
          {(
            [
              ['read', 'Читаю'],
              ['questions', 'Отвечаю'],
              ['write', 'Пишу'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mode === value}
              data-active={mode === value ? '' : undefined}
              onClick={() => changeMode(value)}
            >
              {value === 'read' ? (
                <Mic size={16} />
              ) : value === 'questions' ? (
                <MessageCircle size={16} />
              ) : (
                <Keyboard size={16} />
              )}{' '}
              {label}
            </button>
          ))}
        </div>
        {textPicker}
        <PracticeMenu>
          <AutoAdvanceSettings model={model} />
          {' '}
          {mode === 'read' && (
            <label className="text-question-option">
              <input
                type="checkbox"
                checked={ask}
                onChange={(e) => setAsk(e.target.checked)}
              />{' '}
              Задать вопрос после прочтения
            </label>
          )}
          {mode === 'read' && !showQuestion && !done && (
            <>
              <div className="text-flow-controls">
                <label>
                  Чтение{' '}
                  <select
                    aria-label="Ведение по тексту"
                    value={model.settings.textFlow}
                    onChange={(e) =>
                      model.update(
                        'textFlow',
                        e.target.value as 'auto' | 'manual',
                      )
                    }
                  >
                    <option value="auto">Автоматическое</option>
                    <option value="manual">Ручное</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={model.settings.showFullText !== false}
                    onChange={(e) =>
                      model.update('showFullText', e.target.checked)
                    }
                  />
                  Показать весь текст
                </label>
              </div>
              <ReadingGuideControls
                model={model}
                wordOnly={item.lines.length === 1}
              />

              {item.lines.length > 1 && model.settings.textFlow !== 'auto' && (
                <div className="reading-line-picker" aria-label="Выбор строки">
                  {item.lines.map((_, i) => (
                    <button
                      key={i}
                      aria-current={line === i ? 'step' : undefined}
                      onClick={() => chooseLine(i)}
                    >
                      Строка {i + 1}
                      {readLines.includes(i) ? ' ✓' : ''}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </PracticeMenu>
      </div>
      <div className="exercise text-exercise">
        <ExerciseHeader
          number={taskNumber}
          total={taskTotal}
          completed={completedTasks}
          sound={model.settings.sound}
          speaking={model.speaking}
          onSpeak={() =>
            model.speak(
              showQuestion
                ? 'Прочитай текст и ответь на вопрос.'
                : mode === 'write'
                  ? 'Перепиши текущую строку.'
                  : 'Прочитай текст вслух.',
            )
          }
        />
        <h2>{item.title}</h2>
        <TaskInstruction
          text={
            showQuestion
              ? mode === 'read'
                ? 'Текст прочитан. Теперь ответь на вопрос.'
                : 'Прочитай текст и выбери ответ на вопрос.'
              : mode === 'write'
                ? 'Перепиши текущую строку. Затем нажми «Проверить» или Enter.'
                : 'Включи микрофон и читай с выделенной строки. Можно не спешить; прочитанное начало сохраняется.'
          }
          sound={model.settings.sound}
          speak={model.speak}
        />

        {(textIllustrations[item.id] || item.lineIllustrations?.length) && (
          <details className="text-illustration" key={item.id}>
            <summary>Показать картинку к тексту</summary>
            {item.lineIllustrations?.[line] ? (
              <div className="illustration-gallery illustration-landscape">
                <img
                  className="reviewed-illustration"
                  src={item.lineIllustrations[line].src + '?v=2'}
                  srcSet={illustrationSources[item.lineIllustrations[line].src]}
                  sizes={illustrationSizes('scene-story')}
                  loading="eager"
                  decoding="async"
                  alt={item.lineIllustrations[line].alt}
                  width={560}
                  height={315}
                />
              </div>
            ) : (
              <IllustrationGallery assetId={textIllustrations[item.id]} />
            )}
          </details>
        )}
        {showQuestion ? (
          <div className="text-reference">
            {item.lines.map((text, i) => (
              <p key={i}>
                {text}{' '}
                <button
                  aria-label={`Послушать строку ${i + 1}`}
                  disabled={!model.settings.sound}
                  onClick={() => model.speak(text)}
                >
                  <Volume2 size={18} />
                </button>
              </p>
            ))}
          </div>
        ) : (
          <>
            <p>
              Строка {line + 1} из {item.lines.length} ·{' '}
              {mode === 'write' ? 'Перепиши строку' : 'Прочитай вслух'}
            </p>
            <div className="full-reading-text">
              {item.lines.map(
                (text, i) =>
                  (model.settings.showFullText !== false || i === line) && (
                    <div
                      key={i}
                      className={
                        'full-text-line' + (i === line ? ' active-line' : '')
                      }
                    >
                      {i === line && mode === 'read' ? (
                        <ReadingGuide
                          text={text}
                          color={model.settings.color}
                          focus={
                            speech.needsHelp
                              ? 'word'
                              : (model.settings.readingFocus ?? 'word')
                          }
                          highlight={
                            model.settings.readingHighlight !== false ||
                            speech.needsHelp
                          }
                          progress={
                            letterOffset(text, readStart) +
                            Math.max(
                              speech.progress,
                              speech.previewProgress ?? 0,
                            )
                          }
                          onSelect={choosePart}
                        />
                      ) : (
                        <span>{text}</span>
                      )}
                      {model.settings.sound && (
                        <button
                          className="quiet"
                          aria-label={
                            i === line
                              ? 'Послушать строку'
                              : `Послушать строку ${i + 1}`
                          }
                          onClick={() => {
                            setMic(false);
                            model.speak(text);
                          }}
                        >
                          <Volume2 size={18} />
                        </button>
                      )}
                    </div>
                  ),
              )}
            </div>
            {mode === 'read' && speech.needsHelp && !accepted && (
              <div className="text-error-place" role="status">
                Продолжи со слова «
                {
                  guideParts(item.lines[line], 'word').find(
                    (p) =>
                      p.letters &&
                      letterOffset(item.lines[line], p.end) >
                        letterOffset(item.lines[line], readStart) +
                          speech.progress,
                  )?.text
                }
                ». Прочитанное начало сохранено.
              </div>
            )}
          </>
        )}
        {!done && showQuestion ? (
          <>
            <h3>
              {item.question}{' '}
              {model.settings.sound && (
                <button
                  aria-label="Послушать вопрос"
                  onClick={() => model.speak(item.question)}
                >
                  <Volume2 size={18} />
                </button>
              )}
            </h3>
            <div className="text-options">
              {options.map((option) => (
                <span className="answer-option" key={option}>
                  <button
                    onClick={() => {
                      if (option === item.answer) finish();
                      else
                        setMessage('Давай найдём ответ в тексте. ' + item.hint);
                    }}
                  >
                    {option}
                  </button>
                  {model.settings.sound && (
                    <button
                      className="quiet"
                      aria-label={`Послушать ответ: ${option}`}
                      onClick={() => model.speak(option)}
                    >
                      <Volume2 size={18} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </>
        ) : (
          !done && (
            <>
              {mode === 'read' && !accepted && (
                <>
                  <progress
                    className="text-read-progress"
                    aria-label="Прочитанная часть строки"
                    max={readingLetters(item.lines[line]).length}
                    value={
                      letterOffset(item.lines[line], readStart) +
                      speech.progress
                    }
                  />
                  {mic && (
                    <>
                      <meter
                        min={0}
                        max={1}
                        value={speech.level}
                        aria-label="Уровень микрофона"
                      />
                      <p role="status">{speech.status}</p>
                    </>
                  )}
                  {!model.settings.micConsent ? (
                    <div className="text-mic-consent">
                      <p>
                        Взрослому: речь распознаётся на устройстве. Голос не
                        отправляется и не сохраняется.
                      </p>
                      <button
                        onClick={() => {
                          model.update('micConsent', true);
                          setMic(true);
                        }}
                      >
                        Разрешить микрофон и начать
                      </button>
                    </div>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => setMic((v) => !v)}
                    >
                      {mic
                        ? 'Выключить микрофон'
                        : 'Начать чтение с микрофоном'}
                    </button>
                  )}
                  <details>
                    <summary>Проверить вместе со взрослым</summary>
                    <button
                      onClick={() => {
                        setAccepted(true);
                        setReadLines((v) => [...new Set([...v, line])]);
                        setMessage('Строка прочитана вместе со взрослым.');
                      }}
                    >
                      Строка прочитана верно
                    </button>
                  </details>
                </>
              )}
              {mode === 'write' && (
                <>
                  <label className="text-writing-label">
                    Твоя строка
                    <textarea
                      ref={input}
                      rows={3}
                      value={answer}
                      disabled={accepted}
                      onChange={(e) => {
                        setAnswer(e.target.value);
                        setHint(undefined);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          !e.shiftKey &&
                          !e.repeat &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          check();
                        }
                      }}
                    />
                  </label>
                  {hint && (
                    <div className="text-typo" aria-label="Подсказка по буквам">
                      {hint.cells.map((cell, i) => (
                        <span key={i} className={cell.changed ? 'changed' : ''}>
                          {cell.changed
                            ? `${cell.before || '□'} → ${cell.after || 'убрать'}`
                            : cell.before}
                        </span>
                      ))}
                    </div>
                  )}
                  {!accepted && (
                    <button onClick={check} disabled={!answer.trim()}>
                      Проверить · Enter
                    </button>
                  )}
                  <p className="muted">
                    Регистр и знаки препинания пока не проверяем.
                  </p>
                </>
              )}
              {accepted && (
                <button
                  className="primary"
                  ref={nextButton}
                  onKeyDown={(e) => {
                    if (e.repeat) e.preventDefault();
                  }}
                  onClick={next}
                >
                  {line + 1 < item.lines.length
                    ? 'Следующая строка →'
                    : mode === 'read' && ask
                      ? 'Ответить на вопрос →'
                      : 'Завершить →'}
                  <AutoAdvance key={`${line}-${question}`} inline enabled={model.settings.autoAdvance && (mode !== 'read' || model.settings.textFlow !== 'auto')} seconds={model.settings.autoAdvanceSeconds} blocked={model.parent || model.paused || model.rest || model.speaking} onNext={next} />
                </button>
              )}
            </>
          )
        )}
        {done && (
          <div className="text-success" role="status">
            ⭐ Молодец! Задание выполнено. ⭐
          </div>
        )}
        {!done && message !== 'Текст прочитан. Теперь ответь на вопрос.' && (
          <p role="status">{message}</p>
        )}
        <div className="exercise-footer">
          <button className="text-button" onClick={repeatExercise}>
            <RotateCcw size={16} />
            Повторить задание
          </button>
          <button className="text-button" onClick={onBack}>
            Пропустить →
          </button>
        </div>
        {done && completedTasks >= taskTotal && !model.settings.autoAdvance && <div className="auto-offer"><p>Продолжать автоматически?</p><AutoAdvanceSettings model={model} /></div>}
        {done && (
          <button className="primary" onClick={onNext ?? onBack}>
            Следующий текст →
            <AutoAdvance inline enabled={model.settings.autoAdvance} seconds={model.settings.autoAdvanceSeconds} blocked={model.parent || model.paused || model.rest || model.speaking} onNext={onNext ?? onBack} />
          </button>
        )}
      </div>
    </>
  );
}
