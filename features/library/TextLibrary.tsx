'use client';
import AutoAdvanceSettings from '@/components/auto-advance-settings';
import { useMemo, useState } from 'react';
import CompletionCelebration from '@/components/completion-celebration';
import { Star } from 'lucide-react';
import TopicBar from '@/components/topic-bar';
import { textLabels, type TextKind } from '@/content/reading-library';
import { topicNames } from '@/lib/topics';
import { textsForTopic } from '@/lib/topic-texts';
import { shuffled } from '@/lib/session';
import type { LessonModel } from '../lesson/use-lesson';
import TextExercise from './TextExercise';
export default function TextLibrary({
  kind,
  model,
}: {
  kind: TextKind;
  model: LessonModel;
}) {
  return (
    <section className="lesson library">
      <div className="lesson-top">
        <div>
          <small>
            ШАГ 0{kind === 'sentences' ? 5 : kind === 'stories' ? 6 : 7} ·
            ЧИТАЕМ И ПОНИМАЕМ
          </small>
          <h1>{textLabels[kind]}</h1>
        </div>
        <span className="pill">
          <Star size={17} />
          {model.stars} <span className="desktop-word">звёзд</span>
        </span>
      </div>
      <TopicBar
        unit={model.settings.unit}
        current={topicNames[model.settings.unit]}
        nextLabel={topicNames[(model.settings.unit + 1) % topicNames.length]}
        onPrevious={
          model.settings.unit > 0
            ? () => {
                model.stop();
                model.update('unit', model.settings.unit - 1);
              }
            : undefined
        }
        onNext={() => {
          model.stop();
          model.update('unit', (model.settings.unit + 1) % topicNames.length);
        }}
        onSelect={(unit) => {
          model.stop();
          model.update('unit', unit);
        }}
        speaking={model.speaking}
        onSpeak={() =>
          model.speak(
            `Сейчас: ${topicNames[model.settings.unit]}. Следующая тема: ${topicNames[(model.settings.unit + 1) % topicNames.length]}.`,
          )
        }
      />
      <AutoAdvanceSettings model={model} />
      <TopicTextSession
        key={kind + ':' + model.settings.unit}
        kind={kind}
        model={model}
      />
    </section>
  );
}
function TopicTextSession({
  kind,
  model,
}: {
  kind: TextKind;
  model: LessonModel;
}) {
  const [round, setRound] = useState(0),
    [index, setIndex] = useState(0);
  const [last, setLast] = useState('');
  const [completed, setCompleted] = useState<string[]>([]);
  const deck = useMemo(() => {
    const result = shuffled(textsForTopic(kind, model.settings.unit));
    if (result.length > 1 && result[0].id === last)
      [result[0], result[1]] = [result[1], result[0]];
    return result;
  }, [kind, model.settings.unit, round]);
  const item = deck[index];
  function next() {
    model.stop();
    if (index + 1 < deck.length) setIndex((n) => n + 1);
    else {
      setCompleted([]);
      setLast(item.id);
      setRound((n) => n + 1);
      setIndex(0);
    }
  }
  if (!item)
    return (
      <p>
        Для этой темы пока нет подходящего текста. Можно потренировать слоги и
        слова или выбрать следующую тему.
      </p>
    );
  return (
    <>
      <CompletionCelebration
        done={completed.length === deck.length && deck.length > 0}
        motion={model.settings.motion}
      />
      <details className="text-session-picker">
        <summary>Выбрать текст этой темы</summary>
        <div className="portal-grid">
          {deck.map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                model.stop();
                setIndex(i);
              }}
            >
              {t.title}
            </button>
          ))}
        </div>
      </details>
      <TextExercise
        key={item.id + ':' + round}
        item={item}
        taskNumber={index + 1}
        taskTotal={deck.length}
        completedTasks={completed.length}
        model={model}
        onComplete={() =>
          setCompleted((ids) =>
            ids.includes(item.id) ? ids : [...ids, item.id],
          )
        }
        onBack={next}
        onNext={next}
      />
    </>
  );
}
