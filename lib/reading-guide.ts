import { wordParts } from '../content/word-bank';
export type ReadingFocus = 'line' | 'word' | 'syllable';
export function syllables(word: string): string[] {
  const known = wordParts(word.toUpperCase());
  if (known.length > 1) {
    let at = 0;
    return known.map((part) => {
      const value = word.slice(at, at + part.length);
      at += part.length;
      return value;
    });
  }
  const vowels = [...word.matchAll(/[аеёиоуыэюя]/giu)].map((m) => m.index!);
  const cuts = [0];
  for (let i = 0; i < vowels.length - 1; i++) {
    const from = vowels[i] + 1,
      to = vowels[i + 1],
      between = word.slice(from, to);
    let cut = from;
    if (between.length > 1 && /^[йьъ]/iu.test(between)) cut++;
    else if (between.length > 1 && /^[лмнр][^лмнрйаеёиоуыэюя]/iu.test(between))
      cut++;
    if (/[ьъ]/iu.test(word[cut] ?? '')) cut++;
    cuts.push(cut);
  }
  cuts.push(word.length);
  return cuts
    .slice(0, -1)
    .map((start, i) => word.slice(start, cuts[i + 1]))
    .filter(Boolean);
}
export function guideParts(text: string, focus: ReadingFocus) {
  if (focus === 'line')
    return [
      {
        text,
        start: 0,
        end: text.length,
        letters: (text.match(/[а-яё]/giu) ?? []).length,
      },
    ];
  const result: {
    text: string;
    start: number;
    end: number;
    letters: number;
  }[] = [];
  for (const match of text.matchAll(/[а-яё]+|[^а-яё]+/giu)) {
    let start = match.index!;
    const pieces =
      focus === 'syllable' && /^[а-яё]+$/iu.test(match[0])
        ? syllables(match[0])
        : [match[0]];
    for (const piece of pieces) {
      result.push({
        text: piece,
        start,
        end: start + piece.length,
        letters: (piece.match(/[а-яё]/giu) ?? []).length,
      });
      start += piece.length;
    }
  }
  return result;
}
export function letterOffset(text: string, sourceOffset: number) {
  return (text.slice(0, sourceOffset).match(/[а-яё]/giu) ?? []).length;
}
export function firstUnreadSource(text: string, covered: Set<number>) {
  let letter = 0;
  for (let i = 0; i < text.length; i++)
    if (/[а-яё]/iu.test(text[i])) {
      if (!covered.has(letter)) return i;
      letter++;
    }
  return null;
}
