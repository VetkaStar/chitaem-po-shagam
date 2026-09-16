import type { TrainerSection } from './task-section';
export interface TrainerLink {
  id: string;
  title: string;
}
export interface TrainerMenuSection {
  id: TrainerSection;
  name: string;
  items: TrainerLink[];
}
const practice = (section: string): TrainerLink[] => [
  { id: `lesson:${section}:read`, title: 'Читаю' },
  { id: `lesson:${section}:fly`, title: 'Ловлю' },
  { id: `lesson:${section}:type`, title: 'Пишу' },
];
const trainer = (
  section: string,
  kind: string,
  title: string,
): TrainerLink => ({ id: `trainer:${kind}:${section}`, title });
export const sections: TrainerMenuSection[] = [
  {
    id: 'letters',
    name: 'Буквы',
    items: [
      ...practice('letters'),
      trainer('letters', 'choice', 'Выбираем букву'),
    ],
  },
  {
    id: 'syllables',
    name: 'Слоги',
    items: [
      trainer('syllables', 'compose', 'Собираем слоги'),
      trainer('syllables', 'find_part', 'Находим часть'),
      ...practice('syllables'),
      trainer('syllables', 'choice', 'Выбираем ответ'),
    ],
  },
  {
    id: 'words',
    name: 'Слова',
    items: [
      trainer('words', 'compose', 'Собираем слова'),
      trainer('words', 'find_part', 'Находим часть'),
      ...practice('words'),
      trainer('words', 'boundary', 'Делим на части'),
      trainer('words', 'transform', 'Меняем слово'),
      trainer('words', 'read_meaning', 'Читаем и понимаем'),
      trainer('words', 'choice', 'Выбираем ответ'),
    ],
  },
  {
    id: 'pictures',
    name: 'Картинки',
    items: [
      { id: 'picture:free', title: 'Свободный ответ' },
      { id: 'picture:letters', title: 'Окошки для букв' },
    ],
  },
  {
    id: 'sentences',
    name: 'Предложения',
    items: [
      { id: 'sentences', title: 'Читаем, отвечаем и пишем' },
      trainer('sentences', 'find_part', 'Находим часть предложения'),
      trainer('sentences', 'choice', 'Выбираем ответ'),
    ],
  },
  {
    id: 'stories',
    name: 'Рассказы',
    items: [
      { id: 'stories', title: 'Читаем, отвечаем и пишем' },
      trainer('stories', 'find_part', 'Находим часть текста'),
    ],
  },
  {
    id: 'poems',
    name: 'Стихи',
    items: [{ id: 'poems', title: 'Читаем, отвечаем и пишем' }],
  },
];
export function findTrainerLink(id: string) {
  return sections
    .flatMap((section) => section.items)
    .find((item) => item.id === id);
}
