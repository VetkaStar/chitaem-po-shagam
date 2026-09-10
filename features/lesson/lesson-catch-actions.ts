import { breaks, checkTyped } from '@/lib/learning';

import { Settings, Entry, Stage, Mode } from './config';
import type { Dispatch, SetStateAction, RefObject } from 'react';

/** Extracted action: state remains owned by useLesson. */
export function createCatchHandler(context: {
  stage: Stage;
  mode: Mode;
  answer: string;
  paused: boolean;
  rest: boolean;
  done: boolean;
  flyCards: { id: number; text: string; caught: boolean }[];
  caughtIds: RefObject<Set<number>>;
  setFlyInputStatus: Dispatch<SetStateAction<string>>;
  setFlyCards: Dispatch<
    SetStateAction<{ id: number; text: string; caught: boolean }[]>
  >;
  setAnswer: Dispatch<SetStateAction<string>>;
  setStars: Dispatch<SetStateAction<number>>;
  setHistory: Dispatch<SetStateAction<Entry[]>>;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  settings: Settings;
  setDone: Dispatch<SetStateAction<boolean>>;
  schedule: {
    due: boolean;
    until: number;
    skips: number;
    shouldRest: (completed: number, length: number) => boolean;
    returned: (skipped: boolean) => void;
    snooze: (n: number) => void;
    touch: () => void;
    suspend: () => void;
  };
  setRestIndex: Dispatch<SetStateAction<number>>;
  setRest: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    stage,
    mode,
    answer,
    paused,
    rest,
    done,
    flyCards,
    caughtIds,
    setFlyInputStatus,
    setFlyCards,
    setAnswer,
    setStars,
    setHistory,
    count,
    setCount,
    settings,
    setDone,
    schedule,
    setRestIndex,
    setRest,
  } = context;
  return function catchCard() {
    if (!answer.trim() || paused || rest || done) return;
    const card = flyCards.find(
      (c) =>
        !c.caught && !caughtIds.current.has(c.id) && checkTyped(answer, c.text),
    );
    if (!card) {
      setFlyInputStatus('Найди такой же на дорожке. Можно исправить ответ.');
      return;
    }
    caughtIds.current.add(card.id);
    setFlyCards((cards) =>
      cards.map((c) => (c.id === card.id ? { ...c, caught: true } : c)),
    );
    setAnswer('');
    setFlyInputStatus(`Поймано: ${card.text}!`);
    setStars((n) => n + 1);
    setHistory((h) =>
      [
        ...h,
        {
          at: new Date().toISOString(),
          target: card.text,
          stage,
          mode,
          result: 'success',
          via: 'catch',
        },
      ].slice(-300),
    );
    const completed = count + 1;
    setCount(completed);
    if (completed >= settings.length) setDone(true);
    else if (schedule.shouldRest(completed, settings.length)) {
      setRestIndex((i) => (i + 1) % breaks.length);
      setRest(true);
    }
  };
}
