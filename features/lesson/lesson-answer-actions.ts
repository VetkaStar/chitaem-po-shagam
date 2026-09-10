import { checkTyped } from '@/lib/learning';
import { pictureAnswer, synonyms } from '@/lib/session';

import { type TypoHint } from '@/lib/typo';

import { Mode, Feedback, Settings } from './config';
import type { Dispatch, SetStateAction, RefObject } from 'react';

/** Extracted action: state remains owned by useLesson. */
export function createAnswerHandler(context: {
  setTypo: Dispatch<SetStateAction<TypoHint | null>>;
  mode: Mode;
  catchCard: () => void;
  awarded: RefObject<boolean>;
  answer: string;
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
  setFeedback: Dispatch<SetStateAction<Feedback>>;
  picture:
    | { word: string; icon: string; hint: string; accept?: undefined }
    | { word: string; icon: string; hint: string; accept: string[] }
    | null;
  target: string;
  settings: Settings;
  showTypo: () => boolean;
  record: (result: string, via: string) => void;
  speak: (text: string) => void;
  pictureMiss: (slots: boolean) => void;
  success: (via: string) => void;
  setHint: Dispatch<SetStateAction<boolean>>;
  setHeard: Dispatch<SetStateAction<string>>;
  setScene: Dispatch<SetStateAction<boolean>>;
  wrongResponse: (value: string, via: string) => void;
}) {
  const {
    setTypo,
    mode,
    catchCard,
    awarded,
    answer,
    schedule,
    setFeedback,
    picture,
    target,
    settings,
    showTypo,
    record,
    speak,
    pictureMiss,
    success,
    setHint,
    setHeard,
    setScene,
    wrongResponse,
  } = context;
  return function submit() {
    setTypo(null);
    if (mode === 'fly') {
      catchCard();
      return;
    }
    if (awarded.current) return;
    if (!answer.trim()) return;
    schedule.touch();
    if (!/[а-яё]/i.test(answer)) {
      setFeedback({
        kind: 'uncertain',
        text: 'Переключи клавиатуру на русский язык.',
      });
      return;
    }
    if (picture) {
      const verdict = pictureAnswer(
        answer,
        target,
        settings.pictureMode === 'free',
      );
      // A nearby spelling gets precise help immediately, before staged retries.
      if (verdict.kind === 'other' && showTypo()) return;
      if (settings.pictureMode === 'letters' && verdict.kind !== 'exact') {
        if (
          verdict.kind === 'part' ||
          verdict.kind === 'related' ||
          verdict.kind === 'similar'
        ) {
          setFeedback({ kind: 'neutral', text: verdict.message });
          record('related', 'slots');
          if (settings.sound && settings.autoSpeech) speak(verdict.message);
          return;
        }
        pictureMiss(true);
        return;
      }
      if (verdict.kind === 'exact') {
        success('typed');
        const variants = [target, ...(synonyms[target] || [])]
          .slice(0, 4)
          .map((x) => x.toLowerCase());
        setFeedback({
          kind: 'success',
          text:
            verdict.message ||
            `Верно! Можно назвать так: ${variants.join(', ')}.`,
        });
      } else if (verdict.kind === 'part') {
        setHint(false);
        setHeard('');
        setFeedback({ kind: 'neutral', text: verdict.message });
        record('observation', 'typed');
        if (settings.sound && settings.autoSpeech) speak(verdict.message);
      } else if (verdict.kind === 'related' || verdict.kind === 'similar') {
        setScene(true);
        setHint(true);
        setFeedback({ kind: 'neutral', text: verdict.message });
        record('related', 'typed');
        if (settings.sound && settings.autoSpeech) speak(verdict.message);
      } else {
        pictureMiss(false);
      }
      return;
    }
    if (checkTyped(answer, target)) success('typed');
    else if (!showTypo()) wrongResponse('', 'typed');
  };
}
