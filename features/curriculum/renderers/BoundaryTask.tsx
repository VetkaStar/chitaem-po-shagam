import { useState } from 'react';
import type { TaskRendererProps } from './types.js';
import { textPositions } from './text-positions.js';
export function BoundaryTask({ task, busy, onSubmit }: TaskRendererProps) {
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <form
      className="curriculum-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          void onSubmit({ boundaries: [...selected].sort((a, b) => a - b) });
      }}
    >
      <fieldset disabled={busy}>
        <legend>Отметь границы между буквами</legend>
        <div className="curriculum-boundaries">
          {textPositions(task.text).map((character) => (
            <span className="curriculum-boundary-unit" key={character.start}>
              <span>{character.text}</span>
              {character.end < task.text.length && (
                <button
                  type="button"
                  disabled={busy}
                  className="curriculum-boundary-button"
                  aria-label={'Граница после буквы ' + character.end}
                  aria-pressed={selected.includes(character.end)}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(character.end)
                        ? current.filter(
                            (position) => position !== character.end,
                          )
                        : [...current, character.end],
                    )
                  }
                >
                  |
                </button>
              )}
            </span>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={busy}>
        Ответить
      </button>
    </form>
  );
}
