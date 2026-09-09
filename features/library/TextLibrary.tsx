'use client';
import { useMemo, useState } from 'react';
import { Volume2, ArrowLeft, Star } from 'lucide-react';
import {
  readingTexts,
  textLabels,
  type TextKind,
} from '@/content/reading-library';
import { shuffled } from '@/lib/session';
import type { LessonModel } from '../lesson/use-lesson';
export default function TextLibrary({
  kind,
  model,
}: {
  kind: TextKind;
  model: LessonModel;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [line, setLine] = useState(0),
    [message, setMessage] = useState(''),
    [completed, setCompleted] = useState<string[]>([]);
  const item = readingTexts.find((t) => t.id === selected);
  const options = useMemo(() => (item ? shuffled(item.options) : []), [item]);
  function open(id: string) {
    model.stop();
    setSelected(id);
    setLine(0);
    setMessage('');
  }
  return (
    <section className="portal-panel library">
      <p className="eyebrow">ЧИТАЕМ И ПОНИМАЕМ</p>
      <h1>{textLabels[kind]}</h1>
      {!item ? (
        <>
          <p>
            Выбери текст. Можно читать по строке, слушать по кнопке и
            возвращаться к началу.
          </p>
          <div className="portal-grid">
            {readingTexts
              .filter((t) => t.kind === kind)
              .map((t) => (
                <button
                  className="portal-card"
                  key={t.id}
                  onClick={() => open(t.id)}
                >
                  <b>{t.title}</b>
                  <span>
                    {t.lines.length}{' '}
                    {t.lines.length === 1 ? 'строка' : 'строки'} · вопрос по
                    смыслу
                  </span>
                </button>
              ))}
          </div>
        </>
      ) : (
        <>
          <button
            className="text-button"
            onClick={() => {
              model.stop();
              setSelected(null);
            }}
          >
            <ArrowLeft size={18} /> Другой текст
          </button>
          <h2>{item.title}</h2>
          <div className="reading-lines">
            {item.lines.map((text, i) => (
              <div key={i} className={line === i ? 'active-line' : ''}>
                <button
                  className="line-text"
                  aria-current={line === i ? 'step' : undefined}
                  onClick={() => setLine(i)}
                >
                  {text}
                </button>
                <button
                  className="quiet"
                  aria-label={`Послушать строку ${i + 1}`}
                  disabled={model.speaking || !model.settings.sound}
                  onClick={() => {
                    setLine(i);
                    model.speak(text);
                  }}
                >
                  <Volume2 size={20} />
                </button>
              </div>
            ))}
          </div>
          <div className="portal-actions">
            <button disabled={line === 0} onClick={() => setLine((n) => n - 1)}>
              Предыдущая строка
            </button>
            <button
              disabled={line === item.lines.length - 1}
              onClick={() => setLine((n) => n + 1)}
            >
              Следующая строка
            </button>
          </div>
          <h3>{item.question}</h3>
          <div className="portal-actions">
            {options.map((o) => (
              <button
                key={o}
                disabled={completed.includes(item.id)}
                onClick={() => {
                  if (o === item.answer) {
                    if (!completed.includes(item.id)) {
                      setCompleted((v) => [...v, item.id]);
                      model.awardReadingText(item.id, item.title);
                    }
                    setMessage('Верно! Ты понял текст. +1 звезда');
                  } else
                    setMessage('Давай найдём ответ в тексте. ' + item.hint);
                }}
              >
                {o}
              </button>
            ))}
          </div>
          <p role="status">{message}</p>
          {completed.includes(item.id) && (
            <button
              className="primary"
              onClick={() => {
                setSelected(null);
                setMessage('');
              }}
            >
              <Star size={18} /> Выбрать следующий текст
            </button>
          )}
          <p className="muted">
            Здесь проверяем понимание текста. Прочитать вслух можно вместе со
            взрослым.
          </p>
        </>
      )}
    </section>
  );
}
