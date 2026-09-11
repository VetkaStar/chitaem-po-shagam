import type { SpeechController } from './lesson-speech-types';
import { selectNarratorVoice } from '@/lib/narrator-voice';
import { Settings } from './config';
import type { Dispatch, SetStateAction, RefObject } from 'react';

/** Extracted action: state remains owned by useLesson. */
export function createVoiceHandler(context: {
  setCooldown: Dispatch<SetStateAction<boolean>>;
  recognition: RefObject<SpeechController | null>;
  speechEpoch: RefObject<number>;
  settings: Settings;
  releaseSoon: (delay?: number) => void;
  setSpeaking: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    setCooldown,
    recognition,
    speechEpoch,
    settings,
    releaseSoon,
    setSpeaking,
  } = context;
  return function speak(text: string) {
    setCooldown(true);
    recognition.current?.setEnabled?.(false);
    speechEpoch.current++;
    const token = speechEpoch.current;
    if (!settings.sound) {
      releaseSoon();
      return;
    }
    if (!('speechSynthesis' in window)) {
      releaseSoon();
      return;
    }
    speechSynthesis.cancel();
    const voices = speechSynthesis.getVoices(),
      voice = selectNarratorVoice(voices, settings.voice);
    if (voices.length && !voice) {
      releaseSoon();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = settings.slow ? 0.72 : 0.9;
    setSpeaking(true);
    u.onend = u.onerror = () => {
      if (speechEpoch.current !== token) return;
      setSpeaking(false);
      setCooldown(true);
      releaseSoon(450);
    };
    speechSynthesis.speak(u);
  };
}
