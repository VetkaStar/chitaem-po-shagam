import { useEffect, useRef, useState } from 'react';
import { startLocalSpeech } from '@/lib/local-speech';
import { advanceTextReading, readingLetters } from '@/lib/text-practice';
import { classifyUtterance } from '@/lib/feedback';
export function useTextMicrophone(
  target: string,
  resetKey: string,
  enabled: boolean,
  deviceId: string,
  onComplete: () => void,
  onRest: () => void,
) {
  const [progress, setProgress] = useState(0),
    [level, setLevel] = useState(0),
    [status, setStatus] = useState('Нажми на микрофон и прочитай строку.');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [needsHelp, setNeedsHelp] = useState(false);
  const [progressKey, setProgressKey] = useState(resetKey);
  const position = useRef(0),
    completed = useRef(false),
    callbacks = useRef({ onComplete, onRest });
  callbacks.current = { onComplete, onRest };
  useEffect(() => {
    position.current = 0;
    completed.current = false;
    setProgress(0);
    setNeedsHelp(false);
    setPreviewProgress(0);
    setProgressKey(resetKey);
  }, [target, resetKey]);
  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      return;
    }
    let active = true;
    const speech = startLocalSpeech({
      deviceId,
      onLevel: (value) => {
        if (active) setLevel(value);
      },
      onStatus: (value) => {
        if (active) setStatus(value);
      },
      onReady: () => {
        if (active) setStatus('Я слушаю. Читай в своём темпе.');
      },
      onPartial: (text) => {
        if (active && !completed.current)
          setPreviewProgress(
            advanceTextReading(target, position.current, text, 1),
          );
      },
      onActivity: (phase) => {
        if (active)
          setStatus(
            phase === 'sound'
              ? 'Слышу тебя. Читай, я жду.'
              : 'Попытка услышана. Продолжай или попробуй ещё раз.',
          );
      },
      onError: (value) => {
        if (active) setStatus(value);
      },
      onResult: (result) => {
        if (!active || completed.current) return;
        setPreviewProgress(0);
        if (classifyUtterance(result.text ?? '', 1, '', []).kind === 'rest') {
          callbacks.current.onRest();
          return;
        }
        const previous = position.current;
        const tokens = result.result;
        let next = previous;
        if (tokens?.length && tokens.every((w) => typeof w.word === 'string')) {
          let trusted = '';
          for (const token of tokens) {
            if (token.conf < 0.65) break;
            trusted += (trusted ? ' ' : '') + token.word;
          }
          next = advanceTextReading(target, previous, trusted, 1);
        } else {
          const confidence = tokens?.length
            ? Math.min(...tokens.map((w) => w.conf))
            : 0;
          next = advanceTextReading(
            target,
            previous,
            result.text ?? '',
            confidence,
          );
        }
        setNeedsHelp(next < readingLetters(target).length);
        position.current = next;
        setProgress(next);
        if (next === readingLetters(target).length && next > 0) {
          completed.current = true;
          speech.setEnabled(false);
          callbacks.current.onComplete();
        } else
          setStatus(
            next
              ? 'Начало прочитано. Продолжай с выделенного места.'
              : 'Пока не удалось подтвердить строку. Попробуй ещё раз или послушай образец.',
          );
      },
    });
    return () => {
      active = false;
      speech.abort();
    };
  }, [target, resetKey, enabled, deviceId]);
  return {
    progress: progressKey === resetKey ? progress : 0,
    previewProgress: progressKey === resetKey ? previewProgress : 0,
    level,
    needsHelp,
    status,
  };
}
