export type TextKind = 'sentences' | 'stories' | 'poems';
export type ReadingText = {
  id: string;
  kind: TextKind;
  title: string;
  lines: string[];
  question: string;
  options: string[];
  answer: string;
  hint: string;
  lineIllustrations?: { src: string; alt: string }[];
};
// Original starter texts. Questions check meaning, not pronunciation.
export const readingTexts: ReadingText[] = [
  {
    id: 'sentence-cat',
    kind: 'sentences',
    title: 'Кот',
    lines: ['Кот спит.'],
    question: 'Что делает кот?',
    options: ['Спит', 'Бежит', 'Ест'],
    answer: 'Спит',
    hint: 'Найди слово после «кот».',
  },
  {
    id: 'sentence-mum',
    kind: 'sentences',
    title: 'Мама',
    lines: ['Мама мыла раму.'],
    question: 'Что мыла мама?',
    options: ['Раму', 'Чашку', 'Руку'],
    answer: 'Раму',
    hint: 'Прочитай последнее слово.',
  },
  {
    id: 'sentence-ball',
    kind: 'sentences',
    title: 'Мяч',
    lines: ['У Нины мяч.'],
    question: 'У кого мяч?',
    options: ['У Нины', 'У мамы', 'У кота'],
    answer: 'У Нины',
    hint: 'Найди имя в предложении.',
  },
  {
    id: 'sentence-fox',
    kind: 'sentences',
    title: 'Лиса',
    lines: ['Лиса идёт в лес.'],
    question: 'Куда идёт лиса?',
    options: ['В лес', 'В дом', 'В парк'],
    answer: 'В лес',
    hint: 'Прочитай два последних слова.',
  },
  {
    id: 'story-cat',
    lineIllustrations: [
      {
        src: 'illustrations/stories/story-cat-01.webp',
        alt: 'Соня и кот Тим в комнате.',
      },
      {
        src: 'illustrations/stories/story-cat-02.webp',
        alt: 'Тим ложится на коврик рядом с Соней.',
      },
      {
        src: 'illustrations/stories/story-cat-03.webp',
        alt: 'Тим спит на коврике рядом с Соней.',
      },
    ],
    kind: 'stories',
    title: 'Тихий уголок',
    lines: [
      'У Сони кот. Его зовут Тим.',
      'Тим лёг на коврик.',
      'Соня села рядом. Кот уснул.',
    ],
    question: 'Где уснул Тим?',
    options: ['На коврике', 'На столе', 'На окне'],
    answer: 'На коврике',
    hint: 'Во второй строке сказано, куда лёг кот.',
  },
  {
    id: 'story-boat',
    lineIllustrations: [
      {
        src: 'illustrations/stories/story-boat-01.webp',
        alt: 'Миша складывает бумажную лодку.',
      },
      {
        src: 'illustrations/stories/story-boat-02.webp',
        alt: 'Миша опускает бумажную лодку в таз с водой.',
      },
      {
        src: 'illustrations/stories/story-boat-03.webp',
        alt: 'Бумажная лодка плывёт, Миша машет ей рукой.',
      },
    ],
    kind: 'stories',
    title: 'Бумажная лодка',
    lines: [
      'Миша сделал лодку из бумаги.',
      'Он пустил её в таз с водой.',
      'Лодка плывёт. Миша машет ей рукой.',
    ],
    question: 'Из чего Миша сделал лодку?',
    options: ['Из бумаги', 'Из дерева', 'Из камня'],
    answer: 'Из бумаги',
    hint: 'Ответ есть в первой строке.',
  },
  {
    id: 'story-seed',
    lineIllustrations: [
      {
        src: 'illustrations/stories/story-seed-01.webp',
        alt: 'Аня сажает семечко в горшок с землёй.',
      },
      {
        src: 'illustrations/stories/story-seed-02.webp',
        alt: 'Аня поливает землю в горшке.',
      },
      {
        src: 'illustrations/stories/story-seed-03.webp',
        alt: 'Аня замечает маленький росток в горшке.',
      },
      {
        src: 'illustrations/stories/story-seed-04.webp',
        alt: 'Аня ставит горшок с ростком ближе к окну.',
      },
    ],
    kind: 'stories',
    title: 'Росток',
    lines: [
      'Аня посадила семечко в горшок.',
      'Она поливала землю.',
      'Однажды появился маленький росток.',
      'Аня поставила горшок поближе к свету.',
    ],
    question: 'Что появилось в горшке?',
    options: ['Росток', 'Мяч', 'Камень'],
    answer: 'Росток',
    hint: 'Посмотри на третью строку.',
  },
  {
    id: 'poem-cat',
    kind: 'poems',
    title: 'Кот у окна',
    lines: [
      'Кот уселся у окошка,',
      'Греет солнце бок немножко.',
      'Кот закрыл глаза и спит.',
      'Солнце рядышком блестит.',
    ],
    question: 'Что греет кота?',
    options: ['Солнце', 'Ветер', 'Дождь'],
    answer: 'Солнце',
    hint: 'Прочитай вторую строку.',
  },
  {
    id: 'poem-rain',
    kind: 'poems',
    title: 'После дождя',
    lines: [
      'Дождик вымыл все дорожки,',
      'Капли сели на окошки.',
      'Солнце вышло из-за туч —',
      'На ладошку прыгнул луч.',
    ],
    question: 'Что вышло из-за туч?',
    options: ['Солнце', 'Луна', 'Снег'],
    answer: 'Солнце',
    hint: 'Ответ прячется в третьей строке.',
  },
  {
    id: 'poem-step',
    kind: 'poems',
    title: 'Мой шаг',
    lines: [
      'Я читаю понемножку,',
      'Буквы строятся в дорожку.',
      'Шаг за шагом я иду,',
      'Слово новое найду.',
    ],
    question: 'Что строится в дорожку?',
    options: ['Буквы', 'Машины', 'Камни'],
    answer: 'Буквы',
    hint: 'Перечитай вторую строку.',
  },
];
export const textLabels: Record<TextKind, string> = {
  sentences: 'Предложения',
  stories: 'Рассказы',
  poems: 'Стихи',
};
