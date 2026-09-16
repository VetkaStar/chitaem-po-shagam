import { useState } from 'react';
import type { Segment } from '../../../lib/curriculum/contracts.js';
import type { TaskRendererProps } from './types.js';
import { textPositions } from './text-positions.js';
import { RangeInput } from './RangeInput.js';
const key = (segment: Segment) =>
  [segment.line, segment.start, segment.end].join(':');
export function FindPartTask({
  task,
  busy,
  onSubmit,
  compactControls,
  submitLabel,
}: TaskRendererProps) {
  const lines = task.lines.length ? task.lines : task.text.split('\n');
  const [segments, setSegments] = useState<Segment[]>([]),
    [anchor, setAnchor] = useState<Segment | null>(null);
  const add = (segment: Segment) => {
    setSegments((current) =>
      current.some((existing) => key(existing) === key(segment))
        ? current
        : [...current, segment],
    );
    setAnchor(null);
  };
  const select = (segment: Segment) => {
    if (!anchor || anchor.line !== segment.line) {
      setAnchor(segment);
      return;
    }
    add({
      line: segment.line,
      start: Math.min(anchor.start, segment.start),
      end: Math.max(anchor.end, segment.end),
    });
  };
  return (
    <form
      className="curriculum-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && segments.length) void onSubmit({ segments });
      }}
    >
      <p>
        Нажми первую и последнюю букву нужной части. Для одной буквы нажми её
        дважды.
      </p>
      <div className="curriculum-span-lines">
        {lines.map((line, lineIndex) => (
          <div
            className="curriculum-span-line"
            key={lineIndex}
            role="group"
            aria-label={'Строка ' + (lineIndex + 1)}
          >
            {textPositions(line).map((character) => (
              <button
                type="button"
                key={character.start}
                disabled={busy}
                className="curriculum-character"
                aria-label={
                  'Строка ' +
                  (lineIndex + 1) +
                  ', знак ' +
                  (character.start + 1) +
                  ': ' +
                  (character.text === ' ' ? 'пробел' : character.text)
                }
                aria-pressed={
                  (anchor?.line === lineIndex &&
                    anchor.start === character.start) ||
                  segments.some(
                    (segment) =>
                      segment.line === lineIndex &&
                      character.start >= segment.start &&
                      character.end <= segment.end,
                  )
                }
                onClick={() =>
                  select({
                    line: lineIndex,
                    start: character.start,
                    end: character.end,
                  })
                }
              >
                {character.text === ' ' ? '␣' : character.text}
              </button>
            ))}
          </div>
        ))}
      </div>
      {anchor && (
        <p role="status">Выбрано начало. Нажми последнюю букву части.</p>
      )}
      {!compactControls && <RangeInput lines={lines} busy={busy} onAdd={add} />}
      <ul className="curriculum-selection">
        {segments.map((segment) => (
          <li key={key(segment)}>
            Строка {segment.line + 1}: «
            {lines[segment.line].slice(segment.start, segment.end)}»
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setSegments((current) =>
                  current.filter((existing) => key(existing) !== key(segment)),
                )
              }
            >
              Убрать часть
            </button>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={busy || !segments.length}>
        {submitLabel || 'Ответить'}
      </button>
    </form>
  );
}
