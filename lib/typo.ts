import { normalize } from './learning';
export type TypoHint = {
  kind: 'replace' | 'missing' | 'extra' | 'swap';
  message: string;
  cells: { before: string; after: string; changed: boolean }[];
};
export function findTypo(
  value: string,
  target: string,
  otherWords: string[] = [],
): TypoHint | null {
  if (!/^[а-яё\s-]+$/iu.test(value)) return null;
  const a = normalize(value),
    b = normalize(target);
  if (
    !a ||
    a === b ||
    Math.abs(a.length - b.length) > 1 ||
    otherWords.some((w) => normalize(w) === a)
  )
    return null;
  let index = 0;
  while (index < Math.min(a.length, b.length) && a[index] === b[index]) index++;
  const cells = (before: string[], after: string[], changed: number[]) =>
    before.map((c, i) => ({
      before: c,
      after: after[i],
      changed: changed.includes(i),
    }));
  if (a.length === b.length) {
    const differences = Array.from(a)
      .map((c, i) => (c !== b[i] ? i : -1))
      .filter((i) => i >= 0);
    if (differences.length === 1)
      return {
        kind: 'replace',
        message: `Почти! Вместо «${a[index]}» нужна «${b[index]}». Исправь выделенную букву.`,
        cells: cells([...a], [...b], [index]),
      };
    if (
      differences.length === 2 &&
      differences[1] === index + 1 &&
      a[index] === b[index + 1] &&
      a[index + 1] === b[index]
    )
      return {
        kind: 'swap',
        message: `Почти! Две буквы поменялись местами. Напиши «${b.slice(index, index + 2)}» в выделенном месте.`,
        cells: cells([...a], [...b], [index, index + 1]),
      };
  }
  if (
    a.length + 1 === b.length &&
    a === b.slice(0, index) + b.slice(index + 1)
  ) {
    const before = [...a];
    before.splice(index, 0, '');
    return {
      kind: 'missing',
      message: `Почти! Пропущена буква «${b[index]}». Добавь её в отмеченное место.`,
      cells: cells(before, [...b], [index]),
    };
  }
  if (
    a.length === b.length + 1 &&
    b === a.slice(0, index) + a.slice(index + 1)
  ) {
    const after = [...b];
    after.splice(index, 0, '');
    return {
      kind: 'extra',
      message: `Почти! Здесь лишняя буква «${a[index]}». Убери выделенную букву.`,
      cells: cells([...a], after, [index]),
    };
  }
  return null;
}
