'use client';
import { useMemo, useState } from 'react';
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
    <section className="portal-panel library">
      <p className="eyebrow">ЧИТАЕМ, ПОНИМАЕМ И ПИШЕМ</p>
      <h1>{textLabels[kind]}</h1>
      <label className="text-question-option">
        Моя тема{' '}
        <select
          aria-label="Общая тема"
          value={model.settings.unit}
          onChange={(e) => model.update('unit', Number(e.target.value))}
        >
          {topicNames.map((name, i) => (
            <option value={i} key={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
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
      <p>
        Текст {index + 1} из {deck.length} · {topicNames[model.settings.unit]}
      </p>
      <details>
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
        model={model}
        onBack={next}
        onNext={next}
      />
    </>
  );
}
