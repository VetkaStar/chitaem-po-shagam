import type { Mode, Task } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
export const trainerDefinitions = [
  {
    id: 'compose',
    title: 'Собираем слова',
    description: 'Собираем слово из предложенных частей.',
    kind: 'compose',
  },
  {
    id: 'boundary',
    title: 'Делим на части',
    description: 'Находим границы между частями слова.',
    kind: 'boundary',
  },
  {
    id: 'find_part',
    title: 'Находим часть',
    description: 'Замечаем нужную часть в словах.',
    kind: 'find_part',
  },
  {
    id: 'transform',
    title: 'Меняем слово',
    description: 'Меняем буквы и читаем получившееся слово.',
    kind: 'transform',
  },
  {
    id: 'read_meaning',
    title: 'Читаем и понимаем',
    description: 'Читаем или слушаем и отвечаем по смыслу.',
    kind: 'read_meaning',
  },
  {
    id: 'choice',
    title: 'Выбираем ответ',
    description: 'Сравниваем варианты и выбираем подходящий.',
    kind: 'choice',
  },
] as const;
export type TrainerId = (typeof trainerDefinitions)[number]['id'];
export function isTrainerId(value: string): value is TrainerId {
  return trainerDefinitions.some((definition) => definition.id === value);
}
export function trainerItems(supply: Supply, id: TrainerId): Task[] {
  const pools = supply.curriculum.reservePools as
    | Record<string, { itemIds?: string[] }>
    | undefined;
  const reserved = new Set(
    Object.values(pools ?? {}).flatMap((pool) => pool.itemIds ?? []),
  );
  reserved.add('task.1bb67acaeb41');
  return Object.values(supply.curriculum.items).filter(
    (item) =>
      item.freeTrainerVisible && item.kind === id && !reserved.has(item.id),
  );
}
export const trainerModeLabels: Record<Mode, string> = {
  read: 'Читаю',
  listen: 'Слушаю',
  shared: 'Вместе со взрослым',
};
export function availableModes(items: Task[]): Mode[] {
  return (['read', 'listen', 'shared'] as const).filter((mode) =>
    items.some((item) => item.allowedModes.includes(mode)),
  );
}
