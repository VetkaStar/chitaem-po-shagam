import type { SpeechCallbacks } from '@/lib/local-speech';
import { levels } from '@/lib/learning';
import { wordPool } from '@/lib/session';
import { SlowReadingAttempt } from '@/lib/slow-reading';

import { classifyUtterance } from '@/lib/feedback';

import { Stage, Feedback, Settings, names } from './config';
import type { Dispatch, SetStateAction, RefObject } from 'react';

/** Extracted action: state remains owned by useLesson. */
export function createSpeechHandler(context: {
  awarded: RefObject<boolean>;
  helpLock: RefObject<boolean>;
  speaking: boolean;
  parent: boolean;
  paused: boolean;
  rest: boolean;
  done: boolean;
  setSpeechPreview: Dispatch<SetStateAction<number>>;
  stage: Stage;
  settings: Settings;
  target: string;
  setFeedback: Dispatch<SetStateAction<Feedback>>;
  stop: () => void;
  setPaused: Dispatch<SetStateAction<boolean>>;
  readingPart: { text: string; start: number } | null;
  partPractice: RefObject<SlowReadingAttempt>;
  setReadingPart: Dispatch<
    SetStateAction<{ text: string; start: number } | null>
  >;
  success: (via: string) => void;
  slowAttempt: RefObject<SlowReadingAttempt>;
  setSpeechProgress: Dispatch<SetStateAction<number>>;
  setAttemptStatus: Dispatch<SetStateAction<string>>;
  wrongResponse: (value: string, via: string) => void;
  setHeard: Dispatch<SetStateAction<string>>;
}) {
  const {
    awarded,
    helpLock,
    speaking,
    parent,
    paused,
    rest,
    done,
    setSpeechPreview,
    stage,
    settings,
    target,
    setFeedback,
    stop,
    setPaused,
    readingPart,
    partPractice,
    setReadingPart,
    success,
    slowAttempt,
    setSpeechProgress,
    setAttemptStatus,
    wrongResponse,
    setHeard,
  } = context;
  return function handleSpeech(r: Parameters<SpeechCallbacks['onResult']>[0]) {
    if (
      awarded.current ||
      helpLock.current ||
      speaking ||
      parent ||
      paused ||
      rest ||
      done
    )
      return;
    setSpeechPreview(0);
    const text = r.text || '',
      confidence = r.result?.length
        ? Math.min(...r.result.map((x) => x.conf))
        : 0;
    if (
      stage === 'letters' &&
      settings.letterMode === 'sounds' &&
      names[target] &&
      text.trim().toUpperCase() === names[target] &&
      confidence >= 0.8
    ) {
      setFeedback({
        kind: 'neutral',
        text: `Ты назвал букву: ${names[target]}. А сейчас попробуй произнести её звук, без названия.`,
      });
      return;
    }
    const candidates =
      stage === 'words'
        ? wordPool(levels.length - 1)
        : levels.flatMap((l) => l[stage === 'pictures' ? 'words' : stage]);
    const verdict = classifyUtterance(
      text,
      confidence,
      stage === 'letters' && settings.letterMode === 'alphabet'
        ? names[target] || target
        : target,
      stage === 'letters' && settings.letterMode === 'alphabet'
        ? candidates.map((x) => names[x] || x)
        : candidates,
      stage === 'letters' && settings.letterMode === 'alphabet' && names[target]
        ? [names[target]]
        : [],
    );
    if (verdict.kind === 'rest') {
      stop();
      setPaused(true);
      return;
    }
    if (stage === 'words' && readingPart) {
      // Keep listening to the remainder, including a fast result containing several syllables.
      const remainder = target.slice(readingPart.start);
      const piece = partPractice.current.accept(text, confidence, remainder);
      setSpeechProgress(readingPart.start + piece.progress);
      if (piece.kind === 'complete') {
        setReadingPart(null);
        if (readingPart.start === 0) success('local-speech');
        else {
          slowAttempt.current.reset();
          setSpeechProgress(0);
          setAttemptStatus(
            'Эта часть прочитана! Теперь прочитай слово целиком.',
          );
        }
      } else if (piece.kind === 'pending') {
        setAttemptStatus('Продолжай читать. Я слушаю.');
      } else if (verdict.kind === 'correct') {
        setReadingPart(null);
        success('local-speech');
      } else
        setAttemptStatus(
          'Не расслышал. Можно читать дальше по слогам или слово целиком.',
        );
      return;
    }
    if (verdict.kind === 'correct') {
      setAttemptStatus('');
      success('local-speech');
      return;
    }
    if (stage !== 'letters') {
      const part = slowAttempt.current.accept(text, confidence, target);
      setSpeechProgress(part.progress);
      if (part.kind === 'complete') {
        setAttemptStatus('');
        success('local-speech-parts');
        return;
      }
      if (part.kind === 'pending') {
        setAttemptStatus('Начало услышано. Продолжай, я жду.');
        return;
      }
    }
    if (verdict.kind === 'ignore') {
      setAttemptStatus(
        'Звук услышан. Попробуй прочитать слово на карточке — можно по частям.',
      );
      return;
    }
    if (verdict.kind === 'wrong') {
      setAttemptStatus('');
      wrongResponse(verdict.heard!, 'local-speech');
      return;
    }
    setHeard('');
    setFeedback({
      kind: 'uncertain',
      text: 'Не расслышал. Скажи ещё раз — я слушаю.',
    });
  };
}
