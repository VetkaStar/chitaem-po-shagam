/** Final transcript equality, not an acoustic confidence or pronunciation score. */
export function exactSpeechAnswer(text: string, target: string): boolean {
  const clean = (value: string) => value.toLocaleLowerCase('ru').normalize('NFC')
    .replace(/ё/g, 'е').replace(/[\s.,!?;:«»"—–-]/gu, '');
  const expected = clean(target);
  return /^[а-я]+$/u.test(expected) && clean(text) === expected;
}
