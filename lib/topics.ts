import { levels } from './learning';

export const topicNames = ['А, У и М', 'Добавляем О', 'Добавляем Х', 'Добавляем С', 'Больше букв', 'Весь алфавит'];
export function nextTopic(stage: string, unit: number) {
  if (stage !== 'pictures' && unit < levels.length - 1) {
    return { stage, unit: unit + 1, label: topicNames[unit + 1] };
  }
  const order = ['letters', 'syllables', 'words', 'pictures'];
  const next = order[(order.indexOf(stage) + 1) % order.length];
  return { stage: next, unit: 0, label: ({ letters: 'Буквы', syllables: 'Слоги', words: 'Слова', pictures: 'Картинки' } as Record<string, string>)[next] };
}
