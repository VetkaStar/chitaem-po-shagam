'use client';
import { useEffect, useRef, useState } from 'react';
import './auto-advance.css';
export default function AutoAdvance({
  enabled,
  blocked,
  seconds,
  onNext,
  label = 'Следующее задание',
}: {
  enabled: boolean;
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
