import { levels } from './learning';
/** Exercise targets use the selected topic's cumulative alphabet. Instructions are separate. */
export function fitsTopic(text: string, unit: number) {
  const allowed = new Set(
    levels[Math.max(0, Math.min(unit, levels.length - 1))].letters,
  );
  return Array.from(text.toLocaleUpperCase('ru'))
    .filter((c) => /[А-ЯЁ]/u.test(c))
    .every((c) => allowed.has(c));
}
