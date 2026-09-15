const labels: Record<string, string> = {
  technology: 'Техника',
  retro_pc: 'Старые компьютеры',
  phones: 'Телефоны',
  consoles: 'Консоли',
  videogames: 'Игры',
  sandbox_building: 'Постройки',
  animals: 'Животные',
  everyday: 'Обычная жизнь',
  nature: 'Природа',
  neutral: 'Без определённой темы',
};
export function interestLabel(tag: string): string {
  return labels[tag] ?? tag.replaceAll('_', ' ');
}
