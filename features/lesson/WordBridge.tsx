'use client';
import { useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { availableBridges } from '@/content/word-bridges';
import { levels } from '@/lib/learning';
import { shuffled } from '@/lib/session';
export default function WordBridge({
  unit,
  target,
  speak,
  sound,
  onInteract,
}: {
  unit: number;
  target: string;
  speak: (s: string) => void;
  sound: boolean;
  onInteract?: () => void;
}) {
  const item = useMemo(() => {
    const all = availableBridges(levels[unit].letters);
    return (
      all.find((b) => b.parts.includes(target)) ||
      all[Math.floor(Math.random() * all.length)]
    );
  }, [unit, target]);
  const cards = useMemo(
    () => (item ? shuffled(item.parts.map((text, id) => ({ text, id }))) : []),
    [item],
  );
  const [chosen, setChosen] = useState<number[]>([]),
    [message, setMessage] = useState('');
  if (!item) return null;
  const done = chosen.length === item.parts.length;
  return (
    <section
      className="word-bridge"
      aria-label="Из слогов в слово"
      onClickCapture={onInteract}
    >
      <h3>Смотри, слоги умеют дружить!</h3>
      <div className="task-instruction">
        {sound && (
          <button
            className="speak-button"
            aria-label="Послушать задание со слогами"
            onClick={() =>
              speak(
                `Смотри, слоги умеют дружить! Собери слово по порядку: ${item.parts.join(', ')}.`,
              )
            }
          >
            <Volume2 size={18} />
          </button>
        )}
        <p>
          Собери слово по порядку: <b>{item.parts.join(' · ')}</b>
        </p>
      </div>
      <div className="bridge-slots" aria-label="Собранные слоги">
        {item.parts.map((p, i) => (
          <span key={i}>{i < chosen.length ? p : '…'}</span>
        ))}
      </div>
      <div className="portal-actions">
        {cards.map((c) => (
          <button
            key={c.id}
            disabled={chosen.includes(c.id) || done}
            onClick={() => {
              if (c.text === item.parts[chosen.length]) {
                setChosen((v) => [...v, c.id]);
                setMessage('Получается!');
              } else
                setMessage(
                  'Найди слог ' +
                    item.parts[chosen.length] +
                    '. Он идёт следующим.',
                );
            }}
          >
            {c.text}
          </button>
        ))}
      </div>
      <p role="status">{done ? `${item.word}! ${item.meaning}` : message}</p>
      {done && sound && (
        <button className="text-button" onClick={() => speak(item.word)}>
          <Volume2 size={18} /> Послушать слово
        </button>
      )}
    </section>
  );
}
