import { wordBank } from '../content/word-bank';
import { levels, normalize } from './learning';

// Word practice has its own starter vocabulary; letter/syllable sets stay progressive.
export const firstWords = [
  'МАМА',
  'ПАПА',
  'ДОМ',
  'КОТ',
  'МАК',
  'СОК',
  'НОС',
  'СОМ',
];
export function wordPool(unit: number) {
  return [
    ...new Set([
      ...wordBank.map((e) => e.word),
      ...levels.slice(0, unit + 1).flatMap((l) => l.words),
    ]),
  ];
}
export function shuffled<T>(items: T[], random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function makeDeck(
  items: string[],
  length: number,
  previous: string[] = [],
) {
  const unique = [...new Set(items)],
    result: string[] = [];
  if (!unique.length) return result;
  while (result.length < length) {
    const batch = shuffled(unique);
    const avoid = result.at(-1) ?? previous[0];
    if (batch.length > 1 && batch[0] === avoid)
      [batch[0], batch[1]] = [batch[1], batch[0]];
    result.push(...batch);
  }
  return result.slice(0, length);
}
export const synonyms: Record<string, string[]> = {
  ДОМ: ['ДОМИК', 'ИЗБА', 'ИЗБУШКА', 'ЖИЛИЩЕ'],
  КОТ: ['КОТИК', 'КОШКА', 'КОШЕЧКА', 'КОТЕНОК', 'КОТЁНОК'],
  ЛУНА: ['МЕСЯЦ'],
  РЫБА: ['РЫБКА', 'РЫБИНА'],
  СЫР: ['СЫРОК', 'КУСОК СЫРА'],
  ЛИСА: ['ЛИСИЧКА', 'ЛИС', 'ЛИСЕНОК'],
  ЛИМОН: ['ЛИМОНЧИК'],
  БАНАН: ['БАНАНЧИК'],
  ЯБЛОКО: ['ЯБЛОЧКО'],
  МАШИНА: ['МАШИНКА', 'АВТОМОБИЛЬ', 'АВТО', 'ЛЕГКОВУШКА'],
  ДЕРЕВО: ['ДЕРЕВЦЕ'],
  СОБАКА: ['СОБАЧКА', 'ПЕС', 'ПЁС', 'ПЕСИК', 'ЩЕНОК'],
};
const pictureParts: Record<string, { parts: string[]; question: string }> = {
  БАНАН: {
    parts: ['КОЖУРА', 'ШКУРКА', 'КОЖИЦА', 'БАНАНОВАЯ КОЖУРА', 'МЯКОТЬ'],
    question: 'А как называется весь фрукт?',
  },
  ЛИМОН: {
    parts: ['КОЖУРА', 'КОЖИЦА', 'ШКУРКА'],
    question: 'А как называется весь фрукт?',
  },
  ЯБЛОКО: {
    parts: [
      'КОЖУРА',
      'КОЖИЦА',
      'ШКУРКА',
      'ЛИСТ',
      'ЛИСТИК',
      'ХВОСТИК',
      'ЧЕРЕНОК',
    ],
    question: 'А как называется весь фрукт?',
  },
  ДОМ: {
    parts: ['КРЫША', 'ОКНО', 'ОКНА', 'ДВЕРЬ', 'СТЕНА', 'СТЕНЫ', 'ТРУБА'],
    question: 'А как называется всё здание?',
  },
  ДЕРЕВО: {
    parts: [
      'СТВОЛ',
      'ВЕТКА',
      'ВЕТКИ',
      'ВЕТВИ',
      'ЛИСТ',
      'ЛИСТИК',
      'ЛИСТЬЯ',
      'КРОНА',
    ],
    question: 'А как называется всё растение?',
  },
  МАШИНА: {
    parts: [
      'КОЛЕСО',
      'КОЛЁСА',
      'КОЛЕСА',
      'ШИНА',
      'ШИНЫ',
      'ДВЕРЬ',
      'ОКНО',
      'ОКНА',
      'ФАРА',
      'ФАРЫ',
    ],
    question: 'А как называется то, на чём едут люди?',
  },
  КОТ: {
    parts: [
      'ХВОСТ',
      'ХВОСТИК',
      'ЛАПА',
      'ЛАПЫ',
      'УХО',
      'УШИ',
      'УСЫ',
      'НОС',
      'ГЛАЗ',
      'ГЛАЗА',
      'ШЕРСТЬ',
    ],
    question: 'А кто это целиком? Он говорит «мяу».',
  },
  СОБАКА: {
    parts: [
      'ХВОСТ',
      'ХВОСТИК',
      'ЛАПА',
      'ЛАПЫ',
      'УХО',
      'УШИ',
      'НОС',
      'ГЛАЗ',
      'ГЛАЗА',
      'ШЕРСТЬ',
    ],
    question: 'А кто это целиком? Он говорит «гав».',
  },
  ЛИСА: {
    parts: [
      'ХВОСТ',
      'ХВОСТИК',
      'ЛАПА',
      'ЛАПЫ',
      'УХО',
      'УШИ',
      'НОС',
      'ГЛАЗ',
      'ГЛАЗА',
      'ШЕРСТЬ',
    ],
    question: 'А как называется этот рыжий лесной зверь?',
  },
  РЫБА: {
    parts: [
      'ХВОСТ',
      'ХВОСТИК',
      'ПЛАВНИК',
      'ПЛАВНИКИ',
      'ГЛАЗ',
      'ГЛАЗА',
      'ЧЕШУЯ',
    ],
    question: 'А как называется всё животное? Оно живёт в воде.',
  },
  СЫР: {
    parts: ['ДЫРКА', 'ДЫРОЧКА', 'ДЫРКИ', 'ДЫРОЧКИ', 'КОРОЧКА'],
    question: 'А как называется весь кусочек еды?',
  },
  ЛУНА: {
    parts: ['КРАТЕР', 'КРАТЕРЫ', 'ПЯТНО', 'ПЯТНА'],
    question: 'А как называется то, что светит в ночном небе?',
  },
};
export function pictureAnswer(value: string, target: string, free = false) {
  const text = normalize(value);
  if (!text) return { kind: 'empty' as const };
  if (text === normalize(target)) return { kind: 'exact' as const };
  const detail = pictureParts[target],
    part = detail?.parts.find((p) => normalize(p) === text);
  if (part)
    return {
      kind: 'part' as const,
      message: `Да, здесь есть ${part.toLowerCase()}. Ты заметил деталь! ${detail.question}`,
    };
  const similar: Record<string, string[]> = {
    ЛУНА: ['СЫР', 'СЫРОК', 'БАНАН'],
    СЫР: ['ЛУНА', 'ГУБКА'],
    ЛИМОН: ['АПЕЛЬСИН', 'ГРУША'],
    ЛИСА: ['СОБАКА', 'КОТ'],
    СОБАКА: ['ВОЛК', 'ЛИСА'],
    ЯБЛОКО: ['ПОМИДОР', 'ТОМАТ'],
  };
  if (similar[target]?.includes(text))
    return {
      kind: 'similar' as const,
      message: `Да, по форме или цвету похоже! Мы загадали другое. Посмотри на новую картинку. ${target === 'ЛУНА' ? 'Это луна в ночном небе.' : `Здесь ${target.toLowerCase()}.`} Напиши «${target}».`,
    };
  const alias = synonyms[target]?.find((x) => normalize(x) === text);
  if (alias && free)
    return {
      kind: 'exact' as const,
      message: `Да, ${alias.toLowerCase()}! Ещё можно сказать: ${target.toLowerCase()}.`,
    };
  if (alias) {
    const message =
      target === 'ДОМ' && ['ИЗБА', 'ИЗБУШКА'].includes(alias)
        ? `Избушка — тоже дом. На этой картинке дом. Давай напишем короткое слово: ДОМ.`
        : `Да, «${alias.toLowerCase()}» — тоже подходит! В этом задании учимся писать «${target}». Попробуй это слово.`;
    return { kind: 'related' as const, message };
  }
  return {
    kind: 'other' as const,
    message: `Давай рассмотрим картинку. Здесь ${target.toLowerCase()}. Попробуй написать «${target}».`,
  };
}
