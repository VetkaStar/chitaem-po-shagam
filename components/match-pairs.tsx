'use client';
import { useState, useEffect, useRef } from 'react';
import { pairDeck } from '@/lib/rest-games';

export default function MatchPairs() {
  const [amount, setAmount] = useState(3),
    [mode, setMode] = useState('memory'),
    [speed, setSpeed] = useState(1800),
    [round, setRound] = useState(0);
  const [cards, setCards] = useState<string[]>([]),
    [open, setOpen] = useState<number[]>([]),
    [matched, setMatched] = useState<number[]>([]);
  const lock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setCards(pairDeck(amount));
    setOpen([]);
    setMatched([]);
    lock.current = false;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [amount, mode, speed, round]);
  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.includes(i)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length === 2) {
      lock.current = true;
      const same = cards[next[0]] === cards[next[1]];
      timer.current = setTimeout(
        () => {
          if (same) setMatched((m) => [...m, ...next]);
          setOpen([]);
          lock.current = false;
        },
        same ? 500 : speed,
      );
    }
  }
  const done = cards.length > 0 && matched.length === cards.length;
  return (
    <div>
      <div className="game-controls">
        <label>
          Игра{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="memory">Запомни картинки</option>
            <option value="visible">Найди одинаковые — всё видно</option>
          </select>
        </label>
        <label>
          Сложность{' '}
          <select
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          >
            {[2, 3, 4, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} пар
              </option>
            ))}
          </select>
        </label>
        <label>
          Время запомнить{' '}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={3000}>3 секунды</option>
            <option value={1800}>1,8 секунды</option>
            <option value={900}>0,9 секунды</option>
          </select>
        </label>
      </div>
      <p role="status">
        {done
          ? 'Все пары нашлись! Молодец!'
          : `Найди две одинаковые картинки. Найдено ${matched.length / 2} из ${amount} пар.`}
      </p>
      <div className="pair-grid pair-expanded">
        {cards.map((c, i) => {
          const visible =
            mode === 'visible' || open.includes(i) || matched.includes(i);
          return (
            <button
              key={round + '-' + i}
              disabled={matched.includes(i)}
              className={matched.includes(i) ? 'paired' : ''}
              aria-label={
                visible ? `Картинка ${c}` : `Открыть карточку ${i + 1}`
              }
              aria-pressed={open.includes(i)}
              onClick={() => flip(i)}
            >
              {visible ? c : '?'}
            </button>
          );
        })}
      </div>
      <button onClick={() => setRound((n) => n + 1)}>
        {done ? 'Ещё пары' : 'Новые картинки'}
      </button>
    </div>
  );
}
