import { levels } from './learning';

export const topicNames = levels.map((l, i) =>
  i === 0
    ? 'А, У и М'
    : l.name.startsWith('+ ')
      ? 'Добавляем ' + l.name.slice(2)
      : l.name,
);
export function nextTopic(stage: string, unit: number) {
  if (stage !== 'pictures' && unit < levels.length - 1) {
    return { stage, unit: unit + 1, label: topicNames[unit + 1] };
  }
  const order = ['letters', 'syllables', 'words', 'pictures'];
  const next = order[(order.indexOf(stage) + 1) % order.length];
  return {
    stage: next,
    unit: 0,
    label: (
      {
        letters: 'Буквы',
        syllables: 'Слоги',
        words: 'Слова',
        pictures: 'Картинки',
      } as Record<string, string>
    )[next],
  };
}
