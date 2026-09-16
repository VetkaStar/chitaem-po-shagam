import type { TrainerSection } from './task-section';
export interface TrainerLink {
  id: string;
  title: string;
  modes?: {
    id: 'compose' | 'find_part' | 'boundary' | 'transform';
    title: string;
  }[];
}
export interface TrainerMenuSection {
  id: TrainerSection;
  name: string;
  items: TrainerLink[];
}
const practice = (section: string, title: string): TrainerLink => ({
  id: `lesson:${section}`,
  title,
});
const trainer = (
  section: string,
  kind: string,
  title: string,
): TrainerLink => ({ id: `trainer:${kind}:${section}`, title });
export const sections: TrainerMenuSection[] = [
  {
    id: 'letters',
    name: 'Буквы',
    items: [practice('letters', 'Буква')],
  },
  {
    id: 'syllables',
    name: 'Слоги',
    items: [
      practice('syllables', 'Слог'),
      {
        id: 'group:parts:syllables',
        title: 'Состав слога',
        modes: [
          { id: 'compose', title: 'Собираем' },
          { id: 'find_part', title: 'Находим часть' },
        ],
      },
    ],
  },
  {
    id: 'words',
    name: 'Слова',
    items: [
      practice('words', 'Целое слово'),
      {
        id: 'group:parts:words',
        title: 'Состав слова',
        modes: [
          { id: 'compose', title: 'Собираем' },
          { id: 'find_part', title: 'Находим часть' },
          { id: 'boundary', title: 'Делим на части' },
          { id: 'transform', title: 'Меняем' },
        ],
      },
      trainer('words', 'read_meaning', 'Читаем и понимаем'),
    ],
  },
  {
    id: 'pictures',
    name: 'Картинки',
    items: [practice('pictures', 'Называем предмет')],
  },
  {
    id: 'sentences',
    name: 'Предложения',
    items: [
      { id: 'sentences', title: 'Предложение' },
      {
        id: 'group:parts:sentences',
        title: 'Состав предложения',
        modes: [{ id: 'find_part', title: 'Находим часть' }],
      },
    ],
  },
  {
    id: 'stories',
    name: 'Рассказы',
    items: [
      { id: 'stories', title: 'Рассказ' },
      {
        id: 'group:parts:stories',
        title: 'Состав текста',
        modes: [{ id: 'find_part', title: 'Находим часть' }],
      },
    ],
  },
  {
    id: 'poems',
    name: 'Стихи',
    items: [{ id: 'poems', title: 'Стихотворение' }],
  },
];
export function findTrainerLink(id: string) {
  return sections
    .flatMap((section) => section.items)
    .find((item) => item.id === id);
}
