import { selectNarratorVoice } from './narrator-voice';
/** Shared Russian narrator configuration for lessons and entry. */
export function narratorUtterance(
  text: string,
  settings: { voice: 'female' | 'male'; slow: boolean },
) {
  const voices = speechSynthesis.getVoices();
  const voice = selectNarratorVoice(voices, settings.voice);
  if (voices.length && !voice) return null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  if (voice) utterance.voice = voice;
  utterance.rate = settings.slow ? 0.72 : 0.9;
  return utterance;
}
