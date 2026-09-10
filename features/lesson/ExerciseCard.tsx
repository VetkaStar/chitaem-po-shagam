'use client';
import { useIllustrationPreload } from '@/components/use-illustration-preload';
import TaskInstruction from '@/components/task-instruction';
import CompletionCelebration from '@/components/completion-celebration';
import { RotateCcw } from 'lucide-react';
import AutoAdvanceSettings from '@/components/auto-advance-settings';
import AutoAdvance from '@/components/auto-advance';
import IllustrationGallery from '@/components/illustration-gallery';
import { wordIllustrations } from '@/content/illustrations';
import ExerciseVoiceMonitor from './ExerciseVoiceMonitor';
import ExerciseFeedback from './ExerciseFeedback';
import ExerciseActions from './ExerciseActions';

import ExerciseMaterial from './ExerciseMaterial';
import ExerciseAnswerInput from './ExerciseAnswerInput';
import type { ExerciseModel } from './exercise-types';

import ReadingGuideControls from './ReadingGuideControls';

import { wordEntry, wordParts } from '@/content/word-bank';
import { useState } from 'react';
import WordBridge from './WordBridge';
import { useEffect, useRef } from 'react';
import { Volume2, ArrowRight, Leaf, HelpCircle } from 'lucide-react';
import ExerciseHeader from '@/components/exercise-header';

export default function ExerciseCard({ model }: { model: ExerciseModel }) {
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
  useIllustrationPreload(wordIllustrations[target]);
  const entry = wordEntry(target);
  const parts = wordParts(target);
  const displayWord = model.showParts ? parts.join('·') : target;
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (feedback.kind === 'success' && !done && !paused && !parent && !rest)
      nextButton.current?.focus({ preventScroll: true });
  }, [feedback.kind, done, paused, parent, rest]);
  return (
    <>
      <CompletionCelebration done={done} motion={settings.motion} />
      <div className={'exercise ' + feedback.kind}>
        <ExerciseHeader
          number={Math.min(count + 1, model.lessonLength)}
          total={model.lessonLength}
          completed={count}
          sound={settings.sound}
          speaking={speaking}
          onSpeak={() => speak(task)}
        />
        {done ? (
          <div className="completion">
            <span className="celebration" aria-hidden>
              🌟
            </span>
            <h2>Ты позанимался. Здорово!</h2>
            <p>Пройдено заданий: {count}. Теперь можно отдохнуть.</p>
            {stage === 'words' && model.lessonLength < settings.length && (
              <p>
                Все доступные слова этой темы пройдены. В следующей теме
                появятся новые буквы и слова.
              </p>
            )}
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
                model.continueLesson();
              }}
            >
              Следующее занятие <ArrowRight size={17} />
              <AutoAdvance inline enabled={settings.autoAdvance} seconds={settings.autoAdvanceSeconds} blocked={parent || paused || rest || speaking} onNext={model.continueLesson} />
            </button>
            {!settings.autoAdvance && <div className="auto-offer"><p>Продолжать автоматически после задания и занятия?</p><AutoAdvanceSettings model={model} /></div>}
          </div>
        ) : (
          <>
            <h2>{task}</h2>
            <TaskInstruction
              text={
                mode === 'fly'
                  ? 'Напечатай одну из движущихся карточек и нажми Enter.'
                  : mode === 'read' && stage === 'letters'
                    ? settings.letterMode === 'sounds'
                      ? 'Включи микрофон и произнеси звук. Можно проверить вместе со взрослым.'
                      : 'Включи микрофон и назови букву. Можно проверить вместе со взрослым.'
                    : mode === 'read'
                      ? 'Включи микрофон и читай в своём темпе. Можно нажать на слог и продолжать с него или прочитать слово целиком.'
                      : 'Введи ответ и нажми галочку или Enter.'
              }
              sound={settings.sound}
              speak={speak}
            />
            <ExerciseMaterial
              mode={mode}
              settings={settings}
              flyCards={flyCards}
              paused={paused}
              parent={parent}
              rest={rest}
              done={done}
              stage={stage}
              picture={picture}
              scene={scene}
              target={target}
              setScene={setScene}
              model={model}
              speechProgress={speechProgress}
              index={index}
              listening={listening}
              feedback={feedback}
              displayWord={displayWord}
              mistakes={mistakes}
            />
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
                {(entry?.icon || wordIllustrations[target]) && (
                  <>
                    <button
                      className="text-button scene-toggle"
                      onClick={() => setShowWordPicture((v) => !v)}
                    >
                      {showWordPicture
                        ? 'Скрыть картинку'
                        : 'Показать картинку'}
                    </button>
                    {showWordPicture &&
                      (wordIllustrations[target] ? (
                        <IllustrationGallery
                          key={`${target}-${index}`}
                          assetId={wordIllustrations[target]}
                        />
                      ) : (
                        <div
                          className="word-picture"
                          role="img"
                          aria-label={target}
                        >
                          {entry?.icon}
                        </div>
                      ))}
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
            <ExerciseAnswerInput
              mode={mode}
              stage={stage}
              settings={settings}
              target={target}
              setFeedback={setFeedback}
              speak={speak}
              speaking={speaking}
              picture={picture}
              index={index}
              answer={answer}
              setAnswer={setAnswer}
              submit={submit}
              mistakes={mistakes}
              feedback={feedback}
              paused={paused}
              parent={parent}
              rest={rest}
              input={input}
              typo={typo}
              setTypo={setTypo}
            />
            <ExerciseVoiceMonitor
              mode={mode}
              lessonMic={lessonMic}
              feedback={feedback}
              listening={listening}
              speaking={speaking}
              cooldown={cooldown}
              spectrum={spectrum}
              loadingSpeech={loadingSpeech}
              attemptStatus={attemptStatus}
              micLevel={micLevel}
              speechProgress={speechProgress}
              target={target}
            />
            <ExerciseFeedback
              feedback={feedback}
              mode={mode}
              flyInputStatus={flyInputStatus}
              settings={settings}
              speaking={speaking}
              speak={speak}
              heard={heard}
              target={target}
              typo={typo}
              hint={hint}
              picture={picture}
              mistakes={mistakes}
              setFeedback={setFeedback}
              setHeard={setHeard}
              stop={stop}
              setRest={setRest}
            />
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
            <ExerciseActions
              countdown={<AutoAdvance key={`${index}-${model.repeatEpoch}`} inline enabled={settings.autoAdvance} seconds={settings.autoAdvanceSeconds} blocked={parent || paused || rest || speaking} onNext={() => next()} />}
              feedback={feedback}
              nextButton={nextButton}
              next={next}
              mode={mode}
              listening={listening}
              listen={listen}
              supported={supported}
              speaking={speaking}
              lessonMic={lessonMic}
              loadingSpeech={loadingSpeech}
              success={success}
              setFeedback={setFeedback}
              setHint={setHint}
              setMistakes={setMistakes}
              record={record}
              speak={speak}
              target={target}
            />
            <div className="exercise-footer">
              <button className="text-button" onClick={model.repeatExercise}>
                <RotateCcw size={16} />
                Повторить задание
              </button>
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
