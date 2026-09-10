'use client';
import { useState } from 'react';
import {
  readingTexts,
  textLabels,
  type TextKind,
} from '@/content/reading-library';
import type { LessonModel } from '../lesson/use-lesson';
import TextExercise from './TextExercise';
export default function TextLibrary({
  kind,
  model,
}: {
  kind: TextKind;
  model: LessonModel;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const item = readingTexts.find((t) => t.id === selected);
  return (
    <section className="portal-panel library">
      <p className="eyebrow">ЧИТАЕМ, ПОНИМАЕМ И ПИШЕМ</p>
      <h1>{textLabels[kind]}</h1>
      {item ? (
        <TextExercise
          key={item.id}
          item={item}
          model={model}
          onBack={() => {
            model.stop();
            setSelected(null);
          }}
        />
      ) : (
        <>
          <p>
            Выбери текст. Его можно прочитать вслух, ответить на вопрос или
            написать по строкам.
          </p>
          <div className="portal-grid">
            {readingTexts
              .filter((t) => t.kind === kind)
              .map((t) => (
                <button
                  className="portal-card"
                  key={t.id}
                  onClick={() => {
                    model.stop();
                    setSelected(t.id);
                  }}
                >
                  <b>{t.title}</b>
                  <span>
                    {t.lines.length}{' '}
                    {t.lines.length === 1 ? 'строка' : 'строки'} · чтение,
                    вопросы, письмо
                  </span>
                </button>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
