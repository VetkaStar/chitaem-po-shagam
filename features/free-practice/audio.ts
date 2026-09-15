import type { FreeExposure } from '../../lib/curriculum/free-exposure.js';
type Recorder = (input: FreeExposure) => Promise<void>;
let recorder: Recorder | null = null;
const targets = new Set<string>();
function canonical(text: string) {
  return text
    .toLocaleUpperCase('ru')
    .replace(/[^А-ЯЁA-Z0-9]+/g, ' ')
    .trim();
}
export function setFreeAudioRecorder(next: Recorder | null) {
  recorder = next;
  targets.clear();
}
export function registerFreeTexts(input: FreeExposure) {
  for (const text of [...(input.texts ?? []), ...(input.promptedTexts ?? [])])
    if (text.trim()) targets.add(text);
}
/** Only actual material inside the spoken utterance is assistance, not generic UI instructions. */
export function beforeFreeSpeech(
  text: string,
  target?: string,
): Promise<void> | null {
  if (!recorder) return null;
  const spoken = ' ' + canonical(text) + ' ';
  const matched = target
    ? [target]
    : [...targets].filter((target) => {
        const normalized = canonical(target);
        return normalized && spoken.includes(' ' + normalized + ' ');
      });
  if (!matched.length) return null;
  return recorder({
    texts: matched,
    promptedTexts: matched,
    heardPassages: matched.filter((t) => /[.!?\n]/.test(t)),
  });
}
