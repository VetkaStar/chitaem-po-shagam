import { levels } from '../lib/learning';

export interface WordFamily {
  id: string;
  word: string;
  parts: string[];
  minUnit: number;
  meaning: string;
}

/** Guided free practice. Availability describes letters, never mastery. */
export const wordFamilies: WordFamily[] = [
  { id: 'mama', word: 'МАМА', parts: ['МА', 'МА'], minUnit: 0, meaning: 'Мама - слово из двух одинаковых слогов.' },
  { id: 'mukha', word: 'МУХА', parts: ['МУ', 'ХА'], minUnit: 2, meaning: 'Муха - маленькое насекомое.' },
  { id: 'luna', word: 'ЛУНА', parts: ['ЛУ', 'НА'], minUnit: 6, meaning: 'Луну видно в ночном небе.' },
  { id: 'sumka', word: 'СУМКА', parts: ['СУМ', 'КА'], minUnit: 8, meaning: 'В сумке удобно носить вещи.' },
  { id: 'lampa', word: 'ЛАМПА', parts: ['ЛАМ', 'ПА'], minUnit: 11, meaning: 'Лампа освещает комнату.' },
  { id: 'krupa', word: 'КРУПА', parts: ['КРУ', 'ПА'], minUnit: 11, meaning: 'Из крупы варят кашу.' },
];

export function availableFamilies(unit: number) {
  const topic = levels[unit];
  if (!topic) return [];
  return wordFamilies.filter(f => unit >= f.minUnit &&
    Array.from(f.word).every(letter => topic.letters.includes(letter)));
}

export function familyForTopic(id: string, unit: number) {
  return availableFamilies(unit).find(f => f.id === id);
}
