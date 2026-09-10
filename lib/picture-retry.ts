/** Unrelated picture answers get a retry before any answer-revealing help. */
export function pictureRetry(
  attempt: number,
  target: string,
  slots: boolean,
  accessible = false,
) {
  if (attempt <= 1)
    return {
      message: 'Пока не верно. Попробуй ещё раз.',
      hint: false,
      scene: false,
    };
  if (slots && attempt === 2)
    return {
      message: accessible
        ? 'Посмотри на линии под окошками и проверь буквы.'
        : 'Посмотри на цвета окошек и проверь буквы.',
      hint: false,
      scene: false,
    };
  if (slots && attempt === 3)
    return {
      message: `Начни с буквы ${target[0]}. Попробуй ещё раз.`,
      hint: false,
      scene: false,
    };
  return {
    message: `Давай вместе. Здесь ${target.toLowerCase()}. Попробуй написать «${target}».`,
    hint: true,
    scene: true,
  };
}
