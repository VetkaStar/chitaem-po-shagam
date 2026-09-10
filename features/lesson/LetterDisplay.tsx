import { names, type Settings } from './config';
export default function LetterDisplay({
  letter,
  settings,
}: {
  letter: string;
  settings: Pick<Settings, 'letterMode' | 'letterCase' | 'color'>;
}) {
  const lower = letter.toLocaleLowerCase('ru');
  const special: Record<string, string> = {
    Й: 'й’',
    Ч: 'ч’',
    Щ: 'щ’',
    Е: 'й’э',
    Ё: 'й’о',
    Ю: 'й’у',
    Я: 'й’а',
  };
  const sound = /[ЪЬ]/.test(letter) ? '—' : `[${special[letter] ?? lower}]`;
  return (
    <div className="letter-display">
      <div
        className={
          'reading ' +
          (settings.color
            ? /[АЕЁИОУЫЭЮЯ]/.test(letter)
              ? 'vowel'
              : 'consonant'
            : '')
        }
      >
        {settings.letterMode === 'sounds'
          ? sound
          : settings.letterCase === 'upper'
            ? letter
            : settings.letterCase === 'lower'
              ? lower
              : `${letter} ${lower}`}
      </div>
      {settings.letterMode === 'alphabet' && (
        <p className="letter-name">
          {/[ЪЬЙ]/.test(letter)
            ? `Название: ${names[letter].toLowerCase()}`
            : `[${(names[letter] ?? letter).toLowerCase()}]`}
        </p>
      )}
      {settings.letterMode === 'sounds' && /[ЕЁЮЯ]/.test(letter) && (
        <p>Так звучит в начале слова. После согласной — иначе.</p>
      )}
    </div>
  );
}
