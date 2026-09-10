import { parseVision } from '@/lib/vision';

import { levels } from '@/lib/learning';

import { Settings, Entry, defaults } from './config';
import type { Dispatch, SetStateAction } from 'react';

/** Restore validated browser progress without changing storage keys. */
export function restoreLessonProgress({
  setSettings,
  setRecentWords,
  setStars,
  setHistory,
  setStorageWarning,
}: {
  setSettings: Dispatch<SetStateAction<Settings>>;
  setRecentWords: Dispatch<SetStateAction<string[]>>;
  setStars: Dispatch<SetStateAction<number>>;
  setHistory: Dispatch<SetStateAction<Entry[]>>;
  setStorageWarning: Dispatch<SetStateAction<string>>;
}) {
  try {
    const raw = JSON.parse(localStorage.getItem('reading-steps-v3') || 'null');
    if (raw) {
      const s = raw.settings || {};
      setSettings({
        ...defaults,
        ...Object.fromEntries(
          Object.keys(defaults)
            .filter((k) => typeof s[k] === typeof defaults[k as keyof Settings])
            .map((k) => [k, s[k]]),
        ),
        unit:
          Number.isInteger(s.unit) && s.unit >= 0 && s.unit < levels.length
            ? s.curriculumVersion === 2
              ? s.unit
              : s.unit === 5
                ? levels.length - 1
                : s.unit === 4
                  ? 10
                  : s.unit
            : 0,
        colorVision: parseVision(s.colorVision),
        pictureMode: s.pictureMode === 'letters' ? 'letters' : 'free',
        wordMode: s.wordMode === 'parts' ? 'parts' : 'whole',
        letterMode: s.letterMode === 'sounds' ? 'sounds' : 'alphabet',
        letterCase:
          s.letterCase === 'upper' || s.letterCase === 'lower'
            ? s.letterCase
            : 'both',
        readingFocus: ['line', 'word', 'syllable'].includes(s.readingFocus)
          ? s.readingFocus
          : 'word',
        readingHighlight: s.readingHighlight !== false,
        flySpeed: [0.5, 1, 1.5, 2].includes(s.flySpeed) ? s.flySpeed : 1,
        breakMinutes: [0, 3, 5, 10, 15].includes(s.breakMinutes)
          ? s.breakMinutes
          : 0,
        curriculumVersion: 2,
        length: [3, 5, 8].includes(s.length) ? s.length : 5,
        breakEvery: [0, 3, 5, 8, 10].includes(s.breakEvery)
          ? s.breakEvery
          : defaults.breakEvery,
      });
      if (Array.isArray(raw.recentWords))
        setRecentWords(
          raw.recentWords
            .filter((x: unknown) => typeof x === 'string')
            .slice(-200),
        );
      if (Number.isInteger(raw.stars) && raw.stars >= 0) setStars(raw.stars);
      if (Array.isArray(raw.history))
        setHistory(
          raw.history
            .filter(
              (e: { target?: unknown; at?: unknown } | null) =>
                e && typeof e.target === 'string' && typeof e.at === 'string',
            )
            .slice(-300),
        );
    }
  } catch {
    setStorageWarning(
      'Сохранение недоступно. Можно заниматься, но результаты останутся только до закрытия страницы.',
    );
  }
}
