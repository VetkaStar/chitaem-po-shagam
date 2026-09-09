'use client';
import { useEffect, useRef, useState } from 'react';
import { bubbleSymbols, type VisionMode } from '@/lib/vision';
import { bubbleRound, bubbleChoice } from '@/lib/rest-games';
const colors = [
  { name: 'розовые', single: 'розовый', fill: '#ee92bb' },
  { name: 'зелёные', single: 'зелёный', fill: '#85c994' },
  { name: 'синие', single: 'синий', fill: '#75a5ec' },
  { name: 'жёлтые', single: 'жёлтый', fill: '#f0d269' },
  { name: 'красные', single: 'красный', fill: '#f07c71' },
];
export default function ColorBubbles({
  motion,
  sound,
  autoSpeech,
  onSpeak,
  onTone,
  vision = 'off',
}: {
  vision?: VisionMode;
  motion: boolean;
  sound: boolean;
  autoSpeech: boolean;
  onSpeak: (s: string) => void;
  onTone: () => void;
}) {
  const [mode, setMode] = useState('colors'),
    [density, setDensity] = useState(2),
    [speed, setSpeed] = useState(1),
    [moving, setMoving] = useState(motion),
    [round, setRound] = useState(0);
  const [board, setBoard] = useState<number[]>([]),
    [order, setOrder] = useState<number[]>([]),
    [step, setStep] = useState(0),
    [popped, setPopped] = useState<number[]>([]),
    [message, setMessage] = useState('');
  const caught = useRef(new Set<number>()),
    locked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    speaker = useRef(onSpeak);
  speaker.current = onSpeak;
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    caught.current.clear();
    locked.current = false;
    setPopped([]);
    setStep(0);
    setMessage('');
    const next = bubbleRound(mode, density);
    setOrder(next.order);
    setBoard(next.board);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, density, round]);
  const done = order.length > 0 && step >= order.length,
    color = colors[order[Math.min(step, order.length - 1)] ?? 0];
  const symbols = vision !== 'off',
    mark = bubbleSymbols[order[Math.min(step, order.length - 1)] ?? 0];
  const task = done
    ? 'Все пузыри по заданию найдены! Молодец!'
    : symbols
      ? mode === 'sequence'
        ? `Лопни один пузырь ${mark.with}.`
        : `Лопни все пузыри ${mark.with}.`
      : mode === 'sequence'
        ? `Теперь лопни один ${color.single} пузырь.`
        : `Лопни все ${color.name} пузыри.`;
  useEffect(() => {
    if (sound && autoSpeech && order.length) speaker.current(task);
  }, [task, sound, autoSpeech, order.length, round]);
  function pop(i: number) {
    if (done || locked.current || caught.current.has(i)) return;
    if (board[i] !== order[step]) {
      setMessage(
        symbols
          ? `Нужен пузырь ${mark.with}. Посмотри на образец.`
          : `Сейчас нужен ${color.single}. Посмотри на образец.`,
      );
      return;
    }
    const result = bubbleChoice(
      board,
      order,
      step,
      [...caught.current],
      i,
      mode,
      density,
    );
    caught.current.add(i);
    setPopped([...caught.current]);
    try {
      onTone();
    } catch {}
    if (result === 'advance') {
      locked.current = true;
      setMessage('Получилось!');
      timer.current = setTimeout(
        () => {
          setStep((s) => s + 1);
          setMessage('');
          locked.current = false;
        },
        mode === 'sequence' ? 650 : 1200,
      );
    } else
      setMessage(
        symbols
          ? 'Верно! Найди остальные с таким же знаком.'
          : 'Верно! Найди остальные такого же цвета.',
      );
  }
  return (
    <div className="color-bubbles">
      <div className="game-controls">
        <label>
          Игра{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="colors">
              {symbols ? 'Собери одинаковые знаки' : 'Собери один цвет'}
            </option>
            <option value="sequence">
              {symbols
                ? 'По очереди: плюс, ромб, квадрат'
                : 'По очереди: красный, жёлтый, синий'}
            </option>
          </select>
        </label>
        <label>
          Сложность{' '}
          <select
            value={density}
            onChange={(e) => setDensity(Number(e.target.value))}
          >
            <option value={1}>Легко — мало пузырьков</option>
            <option value={2}>Средне</option>
            <option value={3}>Сложнее — больше пузырьков</option>
          </select>
        </label>
        <label>
          Скорость{' '}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={0.5}>Очень медленно</option>
            <option value={1}>Медленно</option>
            <option value={2}>Быстрее</option>
          </select>
        </label>
        <button
          aria-pressed={moving && motion}
          disabled={!motion}
          onClick={() => setMoving((v) => !v)}
        >
          {moving && motion ? 'Остановить движение' : 'Включить движение'}
        </button>
      </div>
      <div className="bubble-goal">
        {symbols ? (
          <span className="vision-symbol" aria-hidden>
            {mark.symbol}
          </span>
        ) : (
          <span
            className="color-swatch"
            style={{ background: color.fill }}
            aria-hidden
          />
        )}
        <p>{task}</p>
        {sound && (
          <button
            aria-label="Озвучить задание с пузырями"
            onClick={() => onSpeak(task)}
          >
            🔊
          </button>
        )}
      </div>
      {mode === 'sequence' && (
        <div className="bubble-sequence" aria-label="Порядок цветов">
          {order.map((c, i) => (
            <span
              key={i}
              className={i === step ? 'current' : i < step ? 'finished' : ''}
              style={{ background: colors[c].fill }}
            >
              {i + 1}.{' '}
              {symbols
                ? `${bubbleSymbols[c].symbol} ${bubbleSymbols[c].name}`
                : colors[c].single}
            </span>
          ))}
        </div>
      )}
      <p role="status" className="bubble-response">
        {message ||
          (symbols
            ? 'Ищи такой же знак, как на образце. Цвет можно не различать.'
            : 'Выбирай нужный цвет. Можно не торопиться.')}
      </p>
      <div
        className={
          'color-bubble-field dense ' +
          (moving && motion ? 'bubble-moving' : 'bubble-static')
        }
      >
        {board.map((c, i) => (
          <div className="color-bubble-slot" key={round + '-' + mode + '-' + i}>
            <button
              className={
                'color-bubble ' + (popped.includes(i) ? 'bubble-popped' : '')
              }
              style={{
                background: colors[c].fill,
                animationDelay: `-${i * 1.7}s`,
                animationDuration: `${(9 + (i % 3) * 2) / speed}s`,
              }}
              aria-label={
                symbols
                  ? `Пузырь ${bubbleSymbols[c].with} ${i + 1}`
                  : `${colors[c].single} пузырь ${i + 1}`
              }
              disabled={done || popped.includes(i)}
              onClick={() => pop(i)}
            >
              {popped.includes(i) ? (
                '✓'
              ) : symbols ? (
                <span className="vision-symbol" aria-hidden>
                  {bubbleSymbols[c].symbol}
                </span>
              ) : (
                ''
              )}
            </button>
          </div>
        ))}
      </div>
      <button onClick={() => setRound((n) => n + 1)}>
        {done ? 'Ещё пузырьки' : 'Начать заново'}
      </button>
    </div>
  );
}
