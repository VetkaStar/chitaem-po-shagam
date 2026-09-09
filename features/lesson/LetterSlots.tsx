'use client';
import { useEffect, useRef } from 'react';
export default function LetterSlots({
  target,
  value,
  onChange,
  onSubmit,
  attempts,
  disabled,
}: {
  target: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  attempts: number;
  disabled: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (!disabled) refs.current[0]?.focus();
  }, [disabled, target]);
  const chars = Array.from(value.padEnd(target.length, ' ')).slice(
    0,
    target.length,
  );
  function set(i: number, v: string) {
    const a = [...chars];
    a[i] =
      v
        .toLocaleUpperCase('ru')
        .replace(/[^А-ЯЁ]/g, '')
        .slice(-1) || ' ';
    onChange(a.join(''));
  }
  return (
    <div className="letter-slots">
      <p>Напиши слово: {target.length} букв.</p>
      <div className="slots-row">
        {Array.from(target).map((letter, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            aria-label={`Буква ${i + 1}${attempts >= 2 && i === 0 ? `, подсказка: ${letter}` : ''}`}
            maxLength={1}
            onFocus={(e) => e.currentTarget.select()}
            autoComplete="off"
            disabled={disabled}
            value={chars[i].trim()}
            placeholder={attempts >= 2 && i === 0 ? letter : ''}
            className={
              attempts >= 1
                ? /[АЕЁИОУЫЭЮЯ]/.test(letter)
                  ? 'slot-vowel'
                  : 'slot-consonant'
                : ''
            }
            onPaste={(e) => {
              e.preventDefault();
              onChange(
                e.clipboardData
                  .getData('text')
                  .toUpperCase()
                  .replace(/[^А-ЯЁ]/g, '')
                  .slice(0, target.length),
              );
            }}
            onChange={(e) => {
              set(i, e.target.value);
              if (e.target.value) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!e.repeat) onSubmit();
              }
              if (e.key === 'Backspace' && !chars[i].trim())
                refs.current[i - 1]?.focus();
              if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
              if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
            }}
          />
        ))}
      </div>
      {attempts >= 1 && (
        <p className="muted">
          Красные окошки — гласные, зелёные — согласные. Это подсказка о буквах,
          не оценка ответа.
        </p>
      )}
      {attempts >= 2 && (
        <p>
          Первая буква — <b>{target[0]}</b>. Продолжай.
        </p>
      )}
      <button
        className="check-button"
        disabled={disabled || !value.trim()}
        onClick={onSubmit}
      >
        Проверить
      </button>
    </div>
  );
}
