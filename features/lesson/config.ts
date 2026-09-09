export type Stage = 'letters' | 'syllables' | 'words' | 'pictures';
export type Mode = 'read' | 'fly' | 'type';
export type Feedback = {
  kind: 'neutral' | 'success' | 'uncertain' | 'error';
  text: string;
};
export type Settings = {
  unit: number;
  curriculumVersion: number;
  length: number;
  breakEvery: number;
  breakMinutes: number;
  pictureMode: 'free' | 'letters';
  wordMode: 'whole' | 'parts';
  letterMode: 'sounds' | 'alphabet';
  flySpeed: number;
  motion: boolean;
  sound: boolean;
  autoSpeech: boolean;
  slow: boolean;
  color: boolean;
  micConsent: boolean;
  micDevice: string;
};
export type Entry = {
  at: string;
  target: string;
  stage: Stage;
  mode: Mode;
  result: string;
  via: string;
};
export const defaults: Settings = {
  unit: 0,
  curriculumVersion: 2,
  length: 5,
  breakEvery: 5,
  breakMinutes: 0,
  pictureMode: 'free',
  wordMode: 'whole',
  letterMode: 'alphabet',
  flySpeed: 1,
  motion: true,
  sound: true,
  autoSpeech: false,
  slow: true,
  color: true,
  micConsent: false,
  micDevice: '',
};
export const stages: { id: Stage; name: string; title: string }[] = [
  { id: 'letters', name: 'Буквы', title: 'Знакомимся с буквами' },
  { id: 'syllables', name: 'Слоги', title: 'Соединяем звуки' },
  { id: 'words', name: 'Слова', title: 'Читаем целое слово' },
  { id: 'pictures', name: 'Картинки', title: 'От картинки к слову' },
];
export const names: Record<string, string> = {
  Б: 'БЭ',
  В: 'ВЭ',
  Г: 'ГЭ',
  Д: 'ДЭ',
  Ж: 'ЖЭ',
  З: 'ЗЭ',
  К: 'КА',
  Л: 'ЭЛЬ',
  М: 'ЭМ',
  Н: 'ЭН',
  П: 'ПЭ',
  Р: 'ЭР',
  С: 'ЭС',
  Т: 'ТЭ',
  Ф: 'ЭФ',
  Х: 'ХА',
  Ц: 'ЦЭ',
  Ч: 'ЧЕ',
  Ш: 'ША',
  Щ: 'ЩА',
  Й: 'И КРАТКОЕ',
  Ь: 'МЯГКИЙ ЗНАК',
  Ъ: 'ТВЁРДЫЙ ЗНАК',
};
