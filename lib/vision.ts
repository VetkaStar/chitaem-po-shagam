export const visionProfiles = {
  off: { label: 'Выключен' },
  protan: {
    label: 'Протанопия / протаномалия',
  },
  deutan: {
    label: 'Дейтеранопия / дейтераномалия',
  },
  tritan: {
    label: 'Тританопия / тританомалия',
  },
  mono: {
    label: 'Монохромный — без опоры на цвет',
  },
} as const;
export type VisionMode = keyof typeof visionProfiles;
export function parseVision(value: unknown): VisionMode {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(visionProfiles, value)
    ? (value as VisionMode)
    : 'off';
}
export const bubbleSymbols = [
  { symbol: '★', name: 'звезда', with: 'со звездой' },
  { symbol: '▲', name: 'треугольник', with: 'с треугольником' },
  { symbol: '■', name: 'квадрат', with: 'с квадратом' },
  { symbol: '◆', name: 'ромб', with: 'с ромбом' },
  { symbol: '+', name: 'плюс', with: 'с плюсом' },
] as const;
