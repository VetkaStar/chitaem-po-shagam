import type { TrainerSection } from './task-section';

const nouns: Record<
  TrainerSection,
  { target: string; part: string; assembled: string }
> = {
  letters: { target: 'букву', part: 'буквы', assembled: 'собранная буква' },
  syllables: { target: 'слог', part: 'слога', assembled: 'собранный слог' },
  words: { target: 'слово', part: 'слова', assembled: 'собранное слово' },
  sentences: {
    target: 'предложение',
    part: 'предложения',
    assembled: 'собранное предложение',
  },
  stories: { target: 'текст', part: 'текста', assembled: 'собранный текст' },
  pictures: { target: 'слово', part: 'слова', assembled: 'собранное слово' },
  poems: { target: 'строку', part: 'строки', assembled: 'собранная строка' },
};

export function exerciseLabels(section: TrainerSection, kind: string) {
  const noun = nouns[section];
  return {
    title:
      kind === 'compose'
        ? `Собери ${noun.target}`
        : kind === 'find_part'
          ? `Найди часть ${noun.part}`
          : kind === 'boundary'
            ? `Раздели ${noun.target} на части`
            : kind === 'transform'
              ? `Измени ${noun.target}`
              : 'Прочитай и ответь на вопрос',
    placeholder: `Здесь появится ${noun.assembled}`,
    textMaterial:
      section === 'sentences' || section === 'stories' || section === 'poems',
  };
}
