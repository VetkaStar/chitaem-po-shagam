import { useState } from 'react';
import type { Mode, Task } from '../../lib/curriculum/contracts.js';
import { interestLabel } from '../roadmap/interest-labels.js';
import { availableModes, trainerModeLabels } from './catalog.js';
export default function TrainerSetup({
  items,
  busy,
  onStart,
}: {
  items: Task[];
  busy: boolean;
  onStart: (itemIds: string[], mode: Mode, length: 3 | 5 | 7) => void;
}) {
  const modes = availableModes(items);
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'read');
  const [theme, setTheme] = useState('all');
  const [length, setLength] = useState<3 | 5 | 7>(5);
  const modeItems = items.filter((item) => item.allowedModes.includes(mode));
  const themes = [
    ...new Set(modeItems.flatMap((item) => item.interestTags)),
  ].filter(
    (tag) =>
      modeItems.filter((item) => item.interestTags.includes(tag)).length >= 3,
  );
  const pool =
    theme === 'all'
      ? modeItems
      : modeItems.filter((item) => item.interestTags.includes(theme));
  const lengths = ([3, 5, 7] as const).filter((value) => value <= pool.length);
  const selectedLength = lengths.includes(length) ? length : lengths[0];
  return (
    <form
      className="trainer-setup curriculum-step"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selectedLength) return;
        const deck = [...pool];
        for (let i = deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        onStart(
          deck.slice(0, selectedLength).map((item) => item.id),
          mode,
          selectedLength,
        );
      }}
    >
      <h2>Новое занятие</h2>
      <label>
        Как заниматься
        <select
          value={mode}
          disabled={busy}
          onChange={(event) => {
            setMode(event.target.value as Mode);
            setTheme('all');
          }}
        >
          {modes.map((value) => (
            <option key={value} value={value}>
              {trainerModeLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Набор заданий
        <select
          value={theme}
          disabled={busy}
          onChange={(event) => setTheme(event.target.value)}
        >
          <option value="all">Все темы</option>
          {themes.map((tag) => (
            <option key={tag} value={tag}>
              {interestLabel(tag)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Заданий в занятии
        <select
          value={selectedLength ?? ''}
          disabled={busy || !lengths.length}
          onChange={(event) =>
            setLength(Number(event.target.value) as 3 | 5 | 7)
          }
        >
          {lengths.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <p>Доступно заданий: {pool.length}. Дорожку настраивать не нужно.</p>
      {!selectedLength && (
        <p role="status">Для этого набора пока недостаточно заданий.</p>
      )}
      <button
        type="submit"
        className="primary"
        disabled={busy || !selectedLength}
      >
        Начать занятие
      </button>
    </form>
  );
}
