import { useEffect, useRef } from 'react';
import type { Presentation } from './presentation.js';
/** Instructions are already part of the saved presentation; never synthesize a target answer. */
export function useInstructionAudio(
  view: Presentation | null,
  enabled: boolean,
  speak: (text: string) => void,
) {
  const last = useRef('');
  const key = view?.kind === 'task' ? view.instanceId : (view?.planId ?? '');
  const text = view?.instruction ?? '';
  useEffect(() => {
    if (enabled && key && last.current !== key) {
      last.current = key;
      speak(text);
    }
  }, [enabled, key, text, speak]);
}
