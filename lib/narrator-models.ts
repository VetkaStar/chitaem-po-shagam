export const piperVoices = [
  { id: 'piper-irina', voiceId: 'ru_RU-irina-medium', label: 'Ирина — женский' },
  { id: 'piper-denis', voiceId: 'ru_RU-denis-medium', label: 'Денис — мужской' },
  { id: 'piper-dmitri', voiceId: 'ru_RU-dmitri-medium', label: 'Дмитрий — мужской' },
  { id: 'piper-ruslan', voiceId: 'ru_RU-ruslan-medium', label: 'Руслан — мужской' },
] as const;
export type Narrator = 'system' | (typeof piperVoices)[number]['id'];
export const parseNarrator = (value: unknown): Narrator => piperVoices.find(v => v.id === value)?.id ?? 'system';
export const piperVoiceId = (value: unknown) => piperVoices.find(v => v.id === value)?.voiceId;
