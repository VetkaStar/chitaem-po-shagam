'use client';
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Star, Volume2, X } from 'lucide-react';
import { useIllustrationPreload } from '@/components/use-illustration-preload';
import TaskInstruction from '@/components/task-instruction';
import CompletionCelebration from '@/components/completion-celebration';
import AutoAdvanceSettings from '@/components/auto-advance-settings';
import AutoAdvance from '@/components/auto-advance';
import IllustrationGallery from '@/components/illustration-gallery';
import ExerciseHeader from '@/components/exercise-header';
import { wordIllustrations } from '@/content/illustrations';
import { wordEntry, wordParts } from '@/content/word-bank';
import { availableBridges } from '@/content/word-bridges';
import { levels } from '@/lib/learning';
import { plural } from '@/lib/plural';
import ExerciseVoiceMonitor from './ExerciseVoiceMonitor';
import ExerciseFeedback from './ExerciseFeedback';
import ExerciseActions from './ExerciseActions';
import ExerciseMaterial from './ExerciseMaterial';
import ExerciseAnswerInput from './ExerciseAnswerInput';
import WordBridge from './WordBridge';
import type { ExerciseModel } from './exercise-types';

const partsHelp = 'Читай по слогам. Потом соединим их в слово.';

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
  const wordRead = stage === 'words' && mode === 'read';
  const nextButton = useRef<HTMLButtonElement>(null);
  const showBridge =
    stage === 'syllables' &&
    feedback.kind === 'success' &&
    (count + 1) % 2 === 0 &&
    availableBridges(levels[settings.unit].letters).length > 0;
  const advanceSeconds = showBridge
    ? Math.max(15, settings.autoAdvanceSeconds)
    : settings.autoAdvanceSeconds;
  const activityKey = `${stage}-${mode}-${target}-${index}-${model.repeatEpoch}-${done}`;
  const [stoppedActivity, setStoppedActivity] = useState<string | null>(null);
  const autoStopped = stoppedActivity === activityKey;
  const stopAdvance = () => setStoppedActivity(activityKey);
  const blocked = parent || paused || rest || speaking;
  // Shown under the main button on laptop and under the feedback on tablet and phone.
  const advanceStop = (place: 'only-wide' | 'only-narrow') =>
    settings.autoAdvance && (done || feedback.kind === 'success') ? (
      <div className={'auto-stop ' + place}>
        <button
          className="link-button"
          onClick={stopAdvance}
          disabled={autoStopped}
        >
          <X size={16} />
          {autoStopped ? 'Автопереход остановлен' : 'Не переходить'}
        </button>
      </div>
    ) : null;
  const instruction =
    mode === 'fly'
      ? 'Напечатай одну из движущихся карточек и нажми Enter.'
      : mode === 'read' && stage === 'letters'
        ? settings.letterMode === 'sounds'
          ? 'Включи микрофон и произнеси звук. Можно проверить вместе со взрослым.'
          : 'Включи микрофон и назови букву. Можно проверить вместе со взрослым.'
        : mode === 'read'
          ? 'Включи микрофон и читай в своём темпе. Можно нажать на слог и продолжать с него или прочитать слово целиком.'
          : 'Введи ответ и нажми «Проверить» или Enter.';
  const restLabel = settings.breakMinutes
    ? `Отдых через ${settings.breakMinutes} ${plural(settings.breakMinutes, ['минуту', 'минуты', 'минут'])}`
    : settings.breakEvery
      ? `Отдых через ${settings.breakEvery} ${plural(settings.breakEvery, ['задание', 'задания', 'заданий'])}`
      : 'Отдых по кнопке «Разминка»';
  function otherCards() {
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
  }
  useEffect(() => {
    if (feedback.kind === 'success' && !done && !paused && !parent && !rest)
      nextButton.current?.focus({ preventScroll: true });
  }, [feedback.kind, done, paused, parent, rest]);
  const answerInput = (
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
  );
  return (
    <>
      <CompletionCelebration done={done} motion={settings.motion} />
      <div className={'exercise ' + feedback.kind}>
        <ExerciseHeader
          number={Math.min(count + 1, model.lessonLength)}
          total={model.lessonLength}
          completed={count}
          label={done ? 'Все задания пройдены' : undefined}
          rest={restLabel}
        />
        {done ? (
          <div className="completion">
            <Star className="completion-star" aria-hidden="true" />
            <h2>Ты позанимался. Здорово!</h2>
            <p>Пройдено заданий: {count}. Теперь можно отдохнуть.</p>
            {stage === 'words' && model.lessonLength < settings.length && (
              <p>
                Все доступные слова этой темы пройдены. В следующей теме
                появятся новые буквы и слова.
              </p>
            )}
            {advanceStop('only-narrow')}
            {!settings.autoAdvance && (
              <div className="auto-offer">
                <p>Продолжать автоматически после задания и занятия?</p>
                <AutoAdvanceSettings model={model} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="task-line">
              {settings.sound && (
                <button
                  className="speak-button"
                  onClick={() => speak(task)}
                  disabled={speaking}
                  aria-label="Озвучить задание"
                >
                  <Volume2 size={20} />
                </button>
              )}
              <h2>{task}</h2>
            </div>
            <TaskInstruction
              text={instruction}
              sound={settings.sound}
              speak={speak}
            />
            {wordRead &&
              showWordPicture &&
              (wordIllustrations[target] ? (
                <IllustrationGallery
                  key={`${target}-${index}`}
                  assetId={wordIllustrations[target]}
                />
              ) : (
                <div className="word-picture" role="img" aria-label={target}>
                  {entry?.icon}
                </div>
              ))}
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
            {wordRead && model.showParts && (
              <div className="word-help">
                <div className="said">
                  {settings.sound && (
                    <button
                      className="speak-button"
                      aria-label="Послушать подсказку"
                      onClick={() => speak(partsHelp)}
                      disabled={speaking}
                    >
                      <Volume2 size={18} />
                    </button>
                  )}
                  <p>{partsHelp}</p>
                </div>
                <div className="word-help-parts">
                  {parts.map((part, i) => (
                    <button
                      key={i}
                      className="part-button"
                      onClick={() => speak(part)}
                      disabled={speaking}
                    >
                      <Volume2 size={22} />
                      {part}
                    </button>
                  ))}
                </div>
              </div>
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
              <div className="material-tools">
                {wordRead && (entry?.icon || wordIllustrations[target]) && (
                  <button
                    className="pill-button"
                    aria-pressed={showWordPicture}
                    onClick={() => setShowWordPicture((v) => !v)}
                  >
                    <ImageIcon size={16} />
                    {showWordPicture ? 'Скрыть картинку' : 'Показать картинку'}
                  </button>
                )}
                {wordRead &&
                  !model.showParts &&
                  !model.wholeAgain &&
                  feedback.kind !== 'success' &&
                  parts.length > 1 && (
                    <button
                      className="pill-button"
                      onClick={() => model.setPartsHelp(true)}
                    >
                      Помоги прочитать по слогам
                    </button>
                  )}
                {answerInput}
              </div>
            ) : (
              answerInput
            )}
            {feedback.kind === 'success' && (
              <div className="success-badge" aria-hidden="true">
                <Star /> <span>+1 звезда</span>
                <Star />
              </div>
            )}
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
            {advanceStop('only-narrow')}
            {showBridge && (
              <WordBridge
                key={index}
                onInteract={stopAdvance}
                unit={settings.unit}
                target={target}
                speak={speak}
                sound={settings.sound}
              />
            )}
          </>
        )}
      </div>
      <ExerciseActions
        done={done}
        autoAdvanceStop={advanceStop('only-wide')}
        countdown={
          <AutoAdvance
            key={`${index}-${model.repeatEpoch}`}
            inline
            stopped={autoStopped}
            enabled={settings.autoAdvance}
            seconds={advanceSeconds}
            blocked={blocked}
            onNext={() => next()}
          />
        }
        continueCountdown={
          <AutoAdvance
            inline
            stopped={autoStopped}
            enabled={settings.autoAdvance}
            seconds={advanceSeconds}
            blocked={blocked}
            onNext={model.continueLesson}
          />
        }
        feedback={feedback}
        nextButton={nextButton}
        next={next}
        mode={mode}
        hint={hint}
        canSubmit={
          !!answer.trim() &&
          feedback.kind !== 'success' &&
          !paused &&
          !parent &&
          !rest
        }
        submit={submit}
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
        onRepeat={model.repeatExercise}
        onOtherCards={otherCards}
        onRest={() => {
          navigate(stage, mode);
          setRest(true);
        }}
        onContinue={model.continueLesson}
      />
    </>
  );
}
