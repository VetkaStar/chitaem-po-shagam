'use client';
import ReadingGuide from './ReadingGuide';
import ReadingGuideControls from './ReadingGuideControls';
import LetterDisplay from './LetterDisplay';
import LetterSlots from './LetterSlots';
import { wordEntry, wordParts } from '@/content/word-bank';
import { useState } from 'react';
import WordBridge from './WordBridge';
import { useEffect, useRef } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  ArrowRight,
  Leaf,
  Star,
  Check,
  RotateCcw,
  HelpCircle,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import PictureScene from '@/components/picture-scene';
import { names } from './config';
import type { LessonModel } from './use-lesson';
export default function ExerciseCard({
  model,
}: {
  model: Pick<
    LessonModel,
    | 'speechPreview'
    | 'readingPart'
    | 'selectReadingPart'
    | 'update'
    | 'showParts'
    | 'wholeAgain'
    | 'setPartsHelp'
    | 'feedback'
    | 'count'
    | 'settings'
    | 'speak'
    | 'task'
    | 'speaking'
    | 'done'
    | 'navigate'
    | 'stage'
    | 'mode'
    | 'setRest'
    | 'flyCards'
    | 'paused'
    | 'parent'
    | 'rest'
    | 'picture'
    | 'scene'
    | 'target'
    | 'setScene'
    | 'index'
    | 'listening'
    | 'mistakes'
    | 'submit'
    | 'input'
    | 'answer'
    | 'typo'
    | 'setTypo'
    | 'setFeedback'
    | 'setAnswer'
    | 'lessonMic'
    | 'cooldown'
    | 'spectrum'
    | 'loadingSpeech'
    | 'attemptStatus'
    | 'micLevel'
    | 'speechProgress'
    | 'flyInputStatus'
    | 'heard'
    | 'hint'
    | 'setHeard'
    | 'stop'
    | 'next'
    | 'listen'
    | 'supported'
    | 'success'
    | 'setHint'
    | 'setMistakes'
    | 'record'
    | 'setFlyCards'
    | 'flyNext'
    | 'pool'
    | 'setFlyInputStatus'
  >;
}) {
  const {
    feedback,
    count,
    settings,
    speak,
    task,
    speaking,
    done,
    navigate,
    stage,
    mode,
    setRest,
    flyCards,
    paused,
    parent,
    rest,
    picture,
    scene,
    target,
    setScene,
    index,
    listening,
    mistakes,
    submit,
    input,
    answer,
    typo,
    setTypo,
    setFeedback,
    setAnswer,
    lessonMic,
    cooldown,
    spectrum,
    loadingSpeech,
    attemptStatus,
    micLevel,
    speechProgress,
    flyInputStatus,
    heard,
    hint,
    setHeard,
    stop,
    next,
    listen,
    supported,
    success,
    setHint,
    setMistakes,
    record,
    setFlyCards,
    flyNext,
    pool,
    setFlyInputStatus,
  } = model;
  const [showWordPicture, setShowWordPicture] = useState(false);
  useEffect(() => setShowWordPicture(false), [target, index]);
  const entry = wordEntry(target);
  const parts = wordParts(target);
  const displayWord = model.showParts ? parts.join('·') : target;
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (feedback.kind === 'success' && !done && !paused && !parent && !rest)
      nextButton.current?.focus();
  }, [feedback.kind, done, paused, parent, rest]);
  return (
    <>
      <div className={'exercise ' + feedback.kind}>
        <div className="exercise-top">
          <span>
            Задание {Math.min(count + 1, settings.length)} из {settings.length}
          </span>
          <button
            className="quiet"
            onClick={() => speak(task)}
            disabled={speaking}
            aria-label="Озвучить задание"
          >
            <Volume2 size={21} />
          </button>
        </div>
        <Progress
          value={(count / settings.length) * 100}
          aria-label="Прогресс занятия"
          className="lesson-progress"
        />
        {done ? (
          <div className="completion">
            <span className="celebration" aria-hidden>
              🌟
            </span>
            <h2>Ты позанимался. Здорово!</h2>
            <p>Пройдено заданий: {count}. Теперь можно отдохнуть.</p>
            <button
              className="primary"
              onClick={() => {
                navigate(stage, mode);
                setRest(true);
              }}
            >
              <Leaf /> Отдохнуть
            </button>
            <button
              className="text-button"
              onClick={() => {
                navigate(stage, mode);
              }}
            >
              Ещё короткое занятие <ArrowRight size={17} />
            </button>
          </div>
        ) : (
          <>
            <h2>{task}</h2>
            {mode === 'fly' ? (
              <div
                className={'catch-game ' + (!settings.motion ? 'still' : '')}
                aria-label="Дорожки с карточками"
              >
                <div className="catch-instruction">
                  Можно ловить в любом порядке
                </div>
                {flyCards.map((card, lane) => (
                  <div className="catch-lane" key={lane}>
                    <div
                      key={card.id}
                      className={'catch-token ' + (card.caught ? 'caught' : '')}
                      data-token={card.text}
                      style={{
                        animationDuration: `${(22 + lane * 5) / settings.flySpeed}s`,
                        animationDelay: `-${lane * 5}s`,
                        animationPlayState:
                          paused || parent || rest || done
                            ? 'paused'
                            : 'running',
                      }}
                    >
                      {stage === 'letters' ? (
                        <LetterDisplay letter={card.text} settings={settings} />
                      ) : (
                        <span>{card.text}</span>
                      )}
                      {card.caught && <Check size={23} />}
                    </div>
                  </div>
                ))}
              </div>
            ) : picture ? (
              <div>
                {scene ? (
                  <PictureScene word={target} />
                ) : (
                  <div
                    className="picture"
                    role="img"
                    aria-label="Картинка предмета для задания"
                  >
                    {picture.icon}
                  </div>
                )}
                <button
                  className="text-button scene-toggle"
                  onClick={() => setScene((v) => !v)}
                >
                  {scene ? 'Первая картинка' : 'Посмотреть другую картинку'}
                </button>
              </div>
            ) : stage === 'words' && mode === 'read' ? (
              <div className="reading">
                <ReadingGuide
                  text={target}
                  color={settings.color}
                  focus={
                    model.showParts
                      ? 'syllable'
                      : settings.readingFocus === 'line'
                        ? 'word'
                        : settings.readingFocus
                  }
                  highlight={settings.readingHighlight}
                  progress={Math.max(speechProgress, model.speechPreview)}
                  selected={model.readingPart?.start}
                  onSelect={model.selectReadingPart}
                />
              </div>
            ) : stage === 'letters' ? (
              <LetterDisplay letter={target} settings={settings} />
            ) : (
              <div
                className="reading"
                key={target + '-' + index}
                style={{
                  animationPlayState:
                    paused ||
                    parent ||
                    rest ||
                    listening ||
                    feedback.kind === 'success'
                      ? 'paused'
                      : 'running',
                }}
                aria-label={target}
              >
                {Array.from(displayWord).map((char, i) => (
                  <span
                    key={i}
                    className={
                      (char === '·'
                        ? 'syllable-gap'
                        : settings.color
                          ? /[АЕЁИОУЫЭЮЯ]/.test(char)
                            ? 'vowel'
                            : 'consonant'
                          : '') +
                      (mistakes > 0 && i === 0 ? ' first-focus' : '')
                    }
                  >
                    {char === '·' ? ' ' : char}
                  </span>
                ))}
              </div>
            )}
            {settings.colorVision !== 'off' &&
              settings.color &&
              mode === 'read' && (
                <p className="vision-legend">
                  <span className="vowel">Гласные — двойная линия</span> ·{' '}
                  <span className="consonant">Согласные — одна линия</span>
                </p>
              )}
            {stage === 'words' && mode === 'read' && (
              <>
                <ReadingGuideControls model={model} wordOnly />
                <p className="reading-guide-hint">
                  Нажми на слово или слог для отдельной попытки. Потом прочитаем
                  слово целиком.
                </p>
                {entry?.icon && (
                  <>
                    <button
                      className="text-button scene-toggle"
                      onClick={() => setShowWordPicture((v) => !v)}
                    >
                      {showWordPicture
                        ? 'Скрыть картинку'
                        : 'Показать картинку'}
                    </button>
                    {showWordPicture && (
                      <div
                        className="word-picture"
                        role="img"
                        aria-label={target}
                      >
                        {entry.icon}
                      </div>
                    )}
                  </>
                )}
                {model.showParts && (
                  <div className="word-help">
                    <p>Читай по слогам. Потом соединим их в слово.</p>
                    {parts.map((part, i) => (
                      <button
                        key={i}
                        onClick={() => speak(part)}
                        disabled={speaking}
                      >
                        🔊 {part}
                      </button>
                    ))}
                  </div>
                )}
                {!model.showParts &&
                  !model.wholeAgain &&
                  feedback.kind !== 'success' &&
                  parts.length > 1 && (
                    <button
                      className="text-button scene-toggle"
                      onClick={() => model.setPartsHelp(true)}
                    >
                      Помоги прочитать по слогам
                    </button>
                  )}
              </>
            )}
            {stage === 'letters' && settings.letterMode === 'sounds' && (
              <p className="sound-note">
                {/[ЪЬ]/.test(target)
                  ? 'У этой буквы нет собственного звука.'
                  : /[ЕЁЮЯ]/.test(target)
                    ? 'Звуки этой буквы зависят от её места в слове. Разберите пример со взрослым.'
                    : 'Произнеси звук коротко, без названия буквы. Например: [б], а не «бэ».'}
              </p>
            )}
            {mode === 'read' ? (
              <button
                className="sample"
                onClick={() =>
                  stage === 'letters' &&
                  settings.letterMode === 'sounds' &&
                  !/[АОУЫИЭ]/.test(target)
                    ? setFeedback({
                        kind: 'neutral',
                        text: 'Попроси взрослого показать звук. Образцы согласных ещё готовятся.',
                      })
                    : speak(
                        stage === 'letters' &&
                          settings.letterMode === 'alphabet'
                          ? names[target] || target
                          : target,
                      )
                }
                disabled={speaking}
              >
                <Volume2 size={16} />
                {stage === 'letters'
                  ? settings.letterMode === 'sounds'
                    ? /[АОУЫИЭ]/.test(target)
                      ? 'Послушать звук'
                      : 'Как произнести звук'
                    : 'Послушать название'
                  : 'Послушать образец'}
              </button>
            ) : picture && settings.pictureMode === 'letters' ? (
              <LetterSlots
                vision={settings.colorVision}
                key={target + '-' + index}
                target={target}
                value={answer}
                onChange={setAnswer}
                onSubmit={submit}
                attempts={Math.max(0, mistakes - 1)}
                disabled={
                  feedback.kind === 'success' || paused || parent || rest
                }
              />
            ) : (
              <form
                className="answer-form"
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    (e.repeat || e.nativeEvent.isComposing)
                  )
                    e.preventDefault();
                }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={input}
                  aria-label="Твой ответ"
                  value={answer}
                  onChange={(e) => {
                    if (typo) {
                      setTypo(null);
                      setFeedback({
                        kind: 'neutral',
                        text: 'Исправь и проверь ещё раз.',
                      });
                    }
                    setAnswer(e.target.value);
                    if (feedback.kind === 'error')
                      setFeedback({
                        kind: 'neutral',
                        text: 'Попробуй ещё раз.',
                      });
                  }}
                  disabled={
                    feedback.kind === 'success' || paused || parent || rest
                  }
                  placeholder={
                    mode === 'fly'
                      ? 'Лови любой!'
                      : stage === 'pictures'
                        ? 'Напиши слово'
                        : 'Напечатай здесь'
                  }
                  lang="ru"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={40}
                />
                <button
                  className="check-button"
                  type="submit"
                  disabled={!answer.trim() || feedback.kind === 'success'}
                  aria-label="Проверить ответ"
                >
                  <Check />
                </button>
              </form>
            )}
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
            {mode === 'read' &&
              speechProgress > 0 &&
              feedback.kind !== 'success' && (
                <div
                  className="slow-progress"
                  aria-label="Услышанная часть слова"
                >
                  {Array.from(target).map((letter, i) => (
                    <span
                      key={i}
                      className={i < speechProgress ? 'heard-letter' : ''}
                    >
                      {letter}
                    </span>
                  ))}
                  <small>Продолжай с выделенной границы — я жду.</small>
                </div>
              )}
            {feedback.kind === 'success' && (
              <div className="success-badge" aria-hidden="true">
                <Star /> <span>+1 звезда</span>
                <Star />
              </div>
            )}
            <div
              className={'feedback ' + feedback.kind}
              role="status"
              aria-live="polite"
            >
              {feedback.kind === 'success' ? (
                <Check size={20} />
              ) : feedback.kind === 'error' ? (
                <RotateCcw size={18} />
              ) : feedback.kind === 'uncertain' ? (
                <HelpCircle size={18} />
              ) : null}
              <span>{mode === 'fly' ? flyInputStatus : feedback.text}</span>
              {mode !== 'fly' && settings.sound && (
                <button
                  className="feedback-speaker"
                  aria-label="Озвучить объяснение"
                  title="Озвучить объяснение"
                  disabled={speaking}
                  onClick={() => speak(feedback.text)}
                >
                  <Volume2 size={19} />
                </button>
              )}
            </div>
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
              <div
                className="typo-help"
                aria-label="Подсказка: исправление букв"
              >
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
            {hint && mode !== 'fly' && (
              <div className="hint-box">
                {picture ? (
                  <>
                    <p>{picture.hint}</p>
                    <p>
                      Слово: <b>{target}</b>
                    </p>
                    <button className="sample" onClick={() => speak(target)}>
                      <Volume2 size={16} /> Послушать слово
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      {mistakes >= 3
                        ? 'Найди такой же. Потом прочитай.'
                        : target.length > 1
                          ? 'Начни с первой буквы и соедини звуки.'
                          : 'Посмотри на букву. Повтори за взрослым.'}
                    </p>
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
                        className="sample"
                        onClick={() => speak(target.toLowerCase())}
                      >
                        <Volume2 size={18} /> Послушать вместе
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
                        className="text-button"
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
            )}
            {stage === 'syllables' &&
              feedback.kind === 'success' &&
              (count + 1) % 2 === 0 && (
                <WordBridge
                  key={index}
                  unit={settings.unit}
                  target={target}
                  speak={speak}
                  sound={settings.sound}
                />
              )}
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
            <div className="exercise-footer">
              {mode !== 'fly' && (
                <button className="text-button" onClick={() => setHint(!hint)}>
                  <HelpCircle size={16} />
                  {hint ? 'Скрыть подсказку' : 'Подсказка'}
                </button>
              )}
              <button
                className="text-button"
                onClick={() => {
                  if (mode === 'fly') {
                    setAnswer('');
                    setFlyCards((cards) =>
                      cards.map(() => {
                        const id = flyNext.current++;
                        return {
                          id,
                          text: pool[Math.floor(Math.random() * pool.length)],
                          caught: false,
                        };
                      }),
                    );
                    setFlyInputStatus('Лови новые!');
                  } else next(true);
                }}
              >
                {mode === 'fly' ? 'Другие карточки' : 'Пропустить'}{' '}
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
