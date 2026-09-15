import { useId, useState } from 'react';
import type { Segment } from '../../../lib/curriculum/contracts.js';
import { textPositions } from './text-positions.js';
interface Props {
  lines: string[];
  busy: boolean;
  onAdd: (segment: Segment) => void;
}
export function RangeInput({ lines, busy, onAdd }: Props) {
  const id = useId(),
    [line, setLine] = useState(0),
    [start, setStart] = useState(0),
    [end, setEnd] = useState(0);
  const positions = textPositions(lines[line] ?? '');
  return (
    <fieldset className="curriculum-range-input" disabled={busy}>
      <legend>Выбрать диапазон с клавиатуры</legend>
      <label htmlFor={id + 'line'}>Строка</label>
      <select
        id={id + 'line'}
        value={line}
        onChange={(event) => {
          setLine(Number(event.target.value));
          setStart(0);
          setEnd(0);
        }}
      >
        {lines.map((_, index) => (
          <option key={index} value={index}>
            Строка {index + 1}
          </option>
        ))}
      </select>
      <label htmlFor={id + 'start'}>Первая буква</label>
      <select
        id={id + 'start'}
        value={start}
        onChange={(event) => setStart(Number(event.target.value))}
      >
        {positions.map((character) => (
          <option key={character.start} value={character.start}>
            {character.start + 1}:{' '}
            {character.text === ' ' ? 'пробел' : character.text}
          </option>
        ))}
      </select>
      <label htmlFor={id + 'end'}>Последняя буква</label>
      <select
        id={id + 'end'}
        value={end}
        onChange={(event) => setEnd(Number(event.target.value))}
      >
        <option value={0}>Выбери конец</option>
        {positions.map((character) => (
          <option key={character.end} value={character.end}>
            {character.start + 1}:{' '}
            {character.text === ' ' ? 'пробел' : character.text}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || end <= start}
        onClick={() => {
          onAdd({ line, start, end });
          setEnd(0);
        }}
      >
        Добавить часть
      </button>
    </fieldset>
  );
}
