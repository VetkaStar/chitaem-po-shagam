'use client';
import { useEffect, useRef, useState } from 'react';
import './auto-advance.css';
export default function AutoAdvance({
  enabled,
  inline = false,
  blocked,
  seconds,
  onNext,
  label = 'Следующее задание',
}: {
  enabled: boolean;
  inline?: boolean;
  blocked: boolean;
  seconds: number;
  onNext: () => void;
  label?: string;
}) {
  const [remaining, setRemaining] = useState(seconds),
    [cancelled, setCancelled] = useState(false);
  const callback = useRef(onNext);
  callback.current = onNext;
  useEffect(() => {
    setRemaining(seconds);
    if (!enabled || blocked || cancelled) return;
    let timer: ReturnType<typeof setInterval> | undefined,
      left = seconds,
      fired = false;
    function suspend() {
      if (timer) clearInterval(timer);
      timer = undefined;
      left = seconds;
      setRemaining(seconds);
    }
    function resume() {
      suspend();
      if (document.hidden || !document.hasFocus()) return;
      timer = setInterval(() => {
        if (document.querySelector?.('.practice-menu[open]')) {
          left = seconds;
          setRemaining(seconds);
          return;
        }
        left--;
        setRemaining(Math.max(0, left));
        if (left <= 0 && !fired) {
          fired = true;
          suspend();
          callback.current();
        }
      }, 1000);
    }
    resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('blur', suspend);
    window.addEventListener('focus', resume);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('blur', suspend);
      window.removeEventListener('focus', resume);
    };
  }, [enabled, blocked, seconds, cancelled]);
  if (!enabled) return null;
  if (inline) return (
    <span className="countdown" role="timer" aria-label={blocked ? 'Отсчёт на паузе' : `Переход через ${remaining} с`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="countdown-track" cx="18" cy="18" r="15" />
        <circle className="countdown-progress" cx="18" cy="18" r="15" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - remaining / seconds)} />
      </svg>
      <span>{blocked ? 'Ⅱ' : remaining}</span>
    </span>
  );
  return (
    <div className="auto-advance" role="status">
      {cancelled
        ? 'Автопереход остановлен. Можно продолжить кнопкой.'
        : blocked
          ? 'Автопереход на паузе.'
          : `${label} через ${remaining} с`}{' '}
      {!cancelled && (
        <button className="text-button" onClick={() => setCancelled(true)}>
          Подожди
        </button>
      )}
    </div>
  );
}
