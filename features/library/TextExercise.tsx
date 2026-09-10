'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { ReadingText } from '@/content/reading-library';
import type { LessonModel } from '../lesson/use-lesson';
import { shuffled } from '@/lib/session';
import { checkTextWriting, readingLetters } from '@/lib/text-practice';
import ReadingGuide from '../lesson/ReadingGuide';
import ReadingGuideControls from '../lesson/ReadingGuideControls';
import { letterOffset, firstUnreadSource } from '@/lib/reading-guide';
import { useTextMicrophone } from './use-text-microphone';
import CompletionCelebration from '@/components/completion-celebration';
import './text-practice.css';
type Mode = 'read' | 'questions' | 'write';
export default function TextExercise({
  item,
  model,
  onBack,
  onNext,
}: {
  item: ReadingText;
  model: LessonModel;
  onBack: () => void;
  onNext?: () => void;
}) {
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
    [mic, setMic] = useState(false);
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
    if (accepted) nextButton.current?.focus();
    else if (mode === 'write') input.current?.focus();
  }, [accepted, mode, line]);
  function finish() {
    setDone(true);
    setMic(false);
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
    if (speech.progress > 0 && !accepted && firstUnreadSource(item.lines[line], covered.current) === null) {
      setAccepted(true);
      setReadLines(v => [...new Set([...v, line])]);
      setMessage('Строка прочитана!');
    }
  }, [speech.progress, line, readStart, accepted]);
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
      setMic(false);
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
      <CompletionCelebration done={done} motion={model.settings.motion} />
      <button className="text-button" onClick={onBack}>
        Пропустить текст →
      </button>
      <h2>{item.title}</h2>
      <div
        className="portal-actions"
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
            onClick={() => changeMode(value)}
          >
            {label}
          </button>
        ))}
      </div>
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
          <ReadingGuideControls model={model} />
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
          <p className="reading-guide-hint">
            Нажми на слово или слог, чтобы читать с этого места. Подсветка
            следует за подтверждённым чтением.
          </p>
        </>
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
          <div className="text-practice-line">
            {mode === 'read' ? (
              <ReadingGuide
                text={item.lines[line]}
                color={model.settings.color}
                focus={model.settings.readingFocus ?? 'word'}
                highlight={model.settings.readingHighlight !== false}
                progress={
                  letterOffset(item.lines[line], readStart) +
                  Math.max(speech.progress, speech.previewProgress ?? 0)
                }
                onSelect={choosePart}
              />
            ) : (
              <span>{item.lines[line]}</span>
            )}
            <button
              aria-label="Послушать строку"
              disabled={!model.settings.sound}
              onClick={() => {
                setMic(false);
                model.speak(item.lines[line]);
              }}
            >
              <Volume2 size={20} />
            </button>
          </div>
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
          <div className="portal-actions">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  if (option === item.answer) finish();
                  else setMessage('Давай найдём ответ в тексте. ' + item.hint);
                }}
              >
                {option}
              </button>
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
                    letterOffset(item.lines[line], readStart) + speech.progress
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
                  <button className="primary" onClick={() => setMic((v) => !v)}>
                    {mic ? 'Выключить микрофон' : 'Начать чтение с микрофоном'}
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
              </button>
            )}
          </>
        )
      )}
      <p role="status">{message}</p>
      {done && (
        <button className="primary" onClick={onNext ?? onBack}>
          Следующий текст →
        </button>
      )}
    </>
  );
}
