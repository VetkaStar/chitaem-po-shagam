/** Browser APIs do not expose gender. Recognize known Russian voice names,
 * otherwise retain an available Russian voice until the recorded packs arrive. */
export function selectNarratorVoice<T extends { lang: string; name: string }>(
  voices: T[],
  preference: 'female' | 'male',
): T | undefined {
  const russian = voices.filter((voice) => /^ru(?:-|_|$)/i.test(voice.lang));
  const names =
    preference === 'male'
      ? /pavel|dmitri|yuri|maxim|александр|павел|дмитрий|юрий|максим/i
      : /irina|svetlana|milena|tatyana|katya|ирина|светлана|милена|татьяна|катя/i;
  return russian.find((voice) => names.test(voice.name)) ?? russian[0];
}
