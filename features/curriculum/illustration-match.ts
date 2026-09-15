import type { Task } from '../../lib/curriculum/contracts.js';

export type IllustrationMatch = { kind: 'word' | 'story'; id: string };

// Exact catalogue targets only. No inflection, substring search, or answer-key lookup.
const words: Record<string, string> = {
  ДОМ: 'picture-01',
  КОТ: 'picture-02',
  ЛУНА: 'picture-03',
  РЫБА: 'picture-04',
  СЫР: 'picture-05',
  ЛИСА: 'picture-06',
  ЛИМОН: 'picture-07',
  БАНАН: 'picture-08',
  ЯБЛОКО: 'picture-09',
  МАШИНА: 'picture-10',
  ДЕРЕВО: 'picture-11',
  СОБАКА: 'picture-12',
  МАМА: 'word-01',
  ПАПА: 'word-02',
  МУХА: 'word-03',
  ОСА: 'word-04',
  СОСНА: 'word-05',
  УСЫ: 'word-06',
  НОС: 'word-07',
  СОН: 'word-08',
  РАМА: 'word-09',
  РУКА: 'word-10',
  МАК: 'word-11',
  СОК: 'word-13',
  РОТ: 'word-14',
  ТОРТ: 'word-15',
  КРОТ: 'word-16',
  СТОЛ: 'word-17',
  КИТ: 'word-18',
  САНИ: 'word-19',
  НИТКИ: 'word-20',
  ПИЛА: 'word-21',
  ЛАПА: 'word-22',
  ВОДА: 'word-23',
  СОМ: 'word-24',
  ШАР: 'word-25',
  ДУБ: 'word-26',
  СУП: 'word-27',
  МЯЧ: 'word-28',
  СНЕГ: 'word-29',
  ЛЕС: 'word-30',
  МОСТ: 'word-32',
  ЗОНТ: 'word-33',
  ХЛЕБ: 'word-34',
  МОРЕ: 'word-35',
  ГОРА: 'word-36',
  НОГА: 'word-37',
  РОЗА: 'word-38',
  ВАЗА: 'word-39',
  КАША: 'word-40',
  ЧАШКА: 'word-41',
  ЛОЖКА: 'word-42',
  ЛОДКА: 'word-43',
  УХО: 'word-44',
  ПОЛ: 'word-45',
  РОСА: 'word-46',
  ЛУПА: 'word-47',
  ЛИПА: 'word-48',
  МЫЛО: 'word-49',
  СУМКА: 'word-50',
  РАК: 'word-51',
  ДИСК: 'word-52',
  БОТ: 'word-54',
  ПУЛЬТ: 'word-55',
  КОНСОЛЬ: 'word-56',
  МОНИТОР: 'word-57',
  КЛАВИАТУРА: 'word-58',
  КАРТРИДЖ: 'word-60',
  СЛОТ: 'word-62',
  ТЕЛЕФОН: 'word-63',
  ПЛАТА: 'word-64',
  КАБЕЛЬ: 'word-65',
  КОРОБКА: 'word-66',
  'ЛИСТ БУМАГИ': 'word-67',
  ЛАК: 'word-68',
  ЛОМ: 'word-69',
  МОЛОКО: 'word-70',
  МАЛИНА: 'word-71',
  КОРОНА: 'word-72',
  ЛОПАТА: 'word-73',
  ПАЛКА: 'word-74',
  МАСКА: 'word-75',
  СТУЛ: 'word-76',
  СЛОН: 'word-77',
  ТРОН: 'word-78',
  ПАР: 'word-79',
  ЛОТО: 'word-80',
  БАК: 'word-81',
  ЛАМА: 'word-82',
  ШАПКА: 'word-83',
  ШОРТЫ: 'word-84',
  МЫШИ: 'word-85',
  СОР: 'word-86',
  НАСОС: 'word-87',
  КОСА: 'word-88',
  БУЛКА: 'word-89',
  БЛОК: 'word-90',
  МОНЕТА: 'word-92',
  ПАПКА: 'word-93',
  СОВА: 'word-94',
  ИГРАЛ: 'word-95',
  ИСКАЛ: 'word-96',
  МЫЛА: 'word-97',
  НЁС: 'word-98',
  ШАГАЛ: 'word-99',
};

const stories: Record<string, string> = {
  'Диск был на столе. Мила убрала диск в коробку.': 'story-disc-box',
  'Лупа была в сумке. Рома положил лупу на стол.': 'story-loupe-table',
  'Карта была на полке. Папа положил карту в папку.': 'story-map-folder',
  'Рома взял лист. Потом нарисовал карту. В конце убрал лист в папку.':
    'story-paper-map',
  'Мила открыла коробку. Потом достала пульт. В конце закрыла коробку.':
    'story-controller-box',
  'В игре Рома построил дом. Потом добавил мост. В конце поставил бота на мост.':
    'story-game-build',
  'Кот подошёл к миске. Потом поел. В конце кот лёг на коврик.':
    'story-cat-meal',
  'Мила открыла фото на телефоне. Потом выбрала фото кота. В конце показала его маме.':
    'story-phone-cat',
  'На столе было темно. Поэтому папа включил лампу. Рома стал читать подпись на диске.':
    'story-lamp-disc',
  'В игре мост был узким. Поэтому Рома добавил ряд блоков. Теперь машина проехала.':
    'story-bridge-width',
  'Мила устала. Поэтому поставила игру на паузу. Потом пошла отдыхать.':
    'story-game-rest',
};

export function illustrationMatch(task: Task): IllustrationMatch | null {
  const metadata = task as Task & { mediaPolicy?: string; meaningKey?: string };
  if (metadata.mediaPolicy !== 'text_first_optional_illustration') return null;
  const story = Object.hasOwn(stories, task.learnerText)
    ? stories[task.learnerText]
    : undefined;
  if (story) return { kind: 'story', id: story };
  const text = task.learnerText.toLocaleUpperCase('ru');
  // A different meaningKey must not reveal another, possibly hidden, target.
  if (
    metadata.meaningKey &&
    metadata.meaningKey.toLocaleUpperCase('ru') !== text
  )
    return null;
  const word = Object.hasOwn(words, text) ? words[text] : undefined;
  return word ? { kind: 'word', id: word } : null;
}
