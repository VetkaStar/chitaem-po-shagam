import type { CSSProperties } from 'react';
export const visionProfiles = {
  off: { label: 'Выключен', first: '#345d4c', second: '#b66145' },
  protan: {
    label: 'Протанопия / протаномалия',
    first: '#005A8D',
    second: '#8C4B00',
  },
  deutan: {
    label: 'Дейтеранопия / дейтераномалия',
    first: '#005A8D',
    second: '#8C4B00',
  },
  tritan: {
    label: 'Тританопия / тританомалия',
    first: '#006358',
    second: '#9A1B4B',
  },
  mono: {
    label: 'Монохромный — без опоры на цвет',
    first: '#202020',
    second: '#505050',
  },
} as const;
export type VisionMode = keyof typeof visionProfiles;
export function parseVision(value: unknown): VisionMode {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(visionProfiles, value)
    ? (value as VisionMode)
    : 'off';
}
export function visionStyle(mode: VisionMode): CSSProperties {
  const p = visionProfiles[mode];
  return {
    '--vision-first': p.first,
    '--vision-second': p.second,
  } as CSSProperties;
}
export const bubbleSymbols = [
  { symbol: '★', name: 'звезда', with: 'со звездой' },
  { symbol: '▲', name: 'треугольник', with: 'с треугольником' },
  { symbol: '■', name: 'квадрат', with: 'с квадратом' },
  { symbol: '◆', name: 'ромб', with: 'с ромбом' },
  { symbol: '+', name: 'плюс', with: 'с плюсом' },
] as const;
