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
  const position = useRef(0),
    completed = useRef(false),
    callbacks = useRef({ onComplete, onRest });
  callbacks.current = { onComplete, onRest };
  useEffect(() => {
    position.current = 0;
    completed.current = false;
    setProgress(0);
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
      onPartial: () => {},
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
        if (classifyUtterance(result.text ?? '', 1, '', []).kind === 'rest') {
          callbacks.current.onRest();
          return;
        }
        const confidence = result.result?.length
          ? Math.min(...result.result.map((w) => w.conf))
          : 0;
        const next = advanceTextReading(
          target,
          position.current,
          result.text ?? '',
          confidence,
        );
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
  return { progress, level, status };
}
