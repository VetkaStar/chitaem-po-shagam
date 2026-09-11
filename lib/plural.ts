/** Russian plural form: plural(3, ['задание', 'задания', 'заданий']) → 'задания'. */
export function plural(n: number, forms: [string, string, string]) {
  const tens = Math.abs(n) % 100,
    ones = tens % 10;
  if (tens > 10 && tens < 20) return forms[2];
  if (ones === 1) return forms[0];
  if (ones >= 2 && ones <= 4) return forms[1];
  return forms[2];
}
