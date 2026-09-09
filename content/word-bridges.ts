export const wordBridges = [
  {
    word: 'МАМА',
    parts: ['МА', 'МА'],
    meaning: 'Мама — целое слово из двух одинаковых слогов.',
  },
  { word: 'МУХА', parts: ['МУ', 'ХА'], meaning: 'Муха — маленькое насекомое.' },
  { word: 'ОСА', parts: ['О', 'СА'], meaning: 'Оса — насекомое с полосками.' },
  {
    word: 'СОСНА',
    parts: ['СОС', 'НА'],
    meaning: 'Сосна — дерево с иголками.',
  },
  { word: 'УСЫ', parts: ['У', 'СЫ'], meaning: 'У кота есть усы.' },
  { word: 'ЛУНА', parts: ['ЛУ', 'НА'], meaning: 'Луну видно в ночном небе.' },
  { word: 'РАМА', parts: ['РА', 'МА'], meaning: 'Рама держит оконное стекло.' },
  { word: 'РУКА', parts: ['РУ', 'КА'], meaning: 'Рукой можно помахать другу.' },
  { word: 'ЛИСА', parts: ['ЛИ', 'СА'], meaning: 'Лиса живёт в лесу.' },
  {
    word: 'ПАПА',
    parts: ['ПА', 'ПА'],
    meaning: 'Папа — слово из двух одинаковых слогов.',
  },
  { word: 'ЛАПА', parts: ['ЛА', 'ПА'], meaning: 'У кота мягкая лапа.' },
];
export function availableBridges(letters: string[]) {
  return wordBridges.filter((b) =>
    Array.from(b.word).every((l) => letters.includes(l)),
  );
}
