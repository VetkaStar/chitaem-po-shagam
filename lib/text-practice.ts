import { matchFragment } from './slow-reading';
import { findTypo } from './typo';
function textWords(text: string) {
  return (
    text
      .toLocaleLowerCase('ru')
      .replace(/ё/g, 'е')
      .match(/[а-я]+/gu) ?? []
  );
}
export function readingLetters(text: string) {
  return textWords(text).join('');
}
export function advanceTextReading(
  target: string,
  progress: number,
  heard: string,
  confidence: number,
) {
  const goal = readingLetters(target),
    part = readingLetters(heard);
  if (!part || confidence < 0.65 || heard.includes('[unk]')) return progress;
  function prefix(start: number) {
    let position = start;
    for (const word of textWords(heard)) {
      const next = matchFragment(word, goal, position);
      if (next === null) break;
      position = next;
    }
    return position;
  }
  return Math.max(progress, prefix(progress), prefix(0));
}
export function checkTextWriting(
  value: string,
  target: string,
  attempts: number,
) {
  const a = textWords(value),
    b = textWords(target);
  if (
    /^[а-яё\s.,!?:;—–«»()\-]+$/iu.test(value) &&
    a.length &&
    a.join(' ') === b.join(' ')
  )
    return { correct: true, message: 'Верно! Строка написана.' };
  if (a.length === b.length) {
    const different = a
      .map((word, i) => (word !== b[i] ? i : -1))
      .filter((i) => i >= 0);
    if (different.length === 1) {
      const i = different[0],
        hint = findTypo(a[i], b[i]);
      if (hint)
        return {
          correct: false,
          message: `Слово ${i + 1}. ${hint.message}`,
          hint,
        };
    }
  }
  return {
    correct: false,
    message:
      attempts < 2
        ? 'Пока не совпало. Посмотри на строку и попробуй ещё раз.'
        : 'Давай по одному слову. Сравни свой текст с образцом сверху: все ли слова на месте?',
  };
}
