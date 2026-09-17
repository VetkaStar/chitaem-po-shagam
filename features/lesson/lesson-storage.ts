import { parseVision } from '@/lib/vision';
import { parseSpeechModel } from '../../lib/speech/models';
import { browserStorage } from '../../lib/progress/profile-storage';

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
  setTrainerRewards,
}: {
  setTrainerRewards?: (ids: string[]) => void;
  setSettings: Dispatch<SetStateAction<Settings>>;
  setRecentWords: Dispatch<SetStateAction<string[]>>;
  setStars: Dispatch<SetStateAction<number>>;
  setHistory: Dispatch<SetStateAction<Entry[]>>;
  setStorageWarning: Dispatch<SetStateAction<string>>;
}) {
  try {
    const raw = JSON.parse(
      browserStorage.getItem('reading-steps-v3') || 'null',
    );
    if (raw) {
      setTrainerRewards?.(
        Array.isArray(raw.trainerRewards)
          ? raw.trainerRewards.filter(
              (id: unknown): id is string => typeof id === 'string',
            )
          : [],
      );
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
        autoAdvanceSeconds:
          Number.isInteger(s.autoAdvanceSeconds) &&
          s.autoAdvanceSeconds >= 1 &&
          s.autoAdvanceSeconds <= 30
            ? s.autoAdvanceSeconds
            : 3,
        voice: s.voice === 'male' ? 'male' : 'female',
        narrator: s.narrator === 'piper-irina' ? 'piper-irina' : 'system',
        speechModel: parseSpeechModel(s.speechModel),
        micProcessing: s.micProcessing !== false,
        layout: s.layout === 'focus' ? 'focus' : 'order',
        look: s.look === 'notebook' ? 'notebook' : 'plain',
        paper: s.paper === 'blue' ? 'blue' : 'main',
        interfaceScale: [100, 120, 140, 160].includes(s.interfaceScale)
          ? s.interfaceScale
          : 100,
        styleChosen: s.styleChosen === true,
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
        textFlow: s.textFlow === 'manual' ? 'manual' : 'auto',
        showFullText: s.showFullText !== false,
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
