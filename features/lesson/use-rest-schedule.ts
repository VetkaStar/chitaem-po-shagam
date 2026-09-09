'use client';
import { useEffect, useRef, useState } from 'react';
import { breakDue } from '@/lib/breaks';
export function useRestSchedule(
  active: boolean,
  every: number,
  minutes: number,
) {
  const elapsed = useRef(0),
    [due, setDue] = useState(false),
    [until, setUntil] = useState(0),
    [skips, setSkips] = useState(0);
  useEffect(() => {
    elapsed.current = 0;
    setDue(false);
  }, [every, minutes]);
  useEffect(() => {
    if (!active || !minutes) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (!document.hidden && now >= until)
        elapsed.current += Math.min(now - last, 2000);
      last = now;
      if (elapsed.current >= minutes * 60000) setDue(true);
    }, 1000);
    return () => clearInterval(id);
  }, [active, minutes, until]);
  function shouldRest(completed: number, length: number) {
    return (
      Date.now() >= until &&
      completed < length &&
      (minutes > 0 ? due : breakDue(completed, every, length))
    );
  }
  function returned(skipped: boolean) {
    elapsed.current = 0;
    setDue(false);
    setSkips((n) => (skipped ? n + 1 : 0));
  }
  function snooze(n: number) {
    setUntil(Date.now() + n * 60000);
    elapsed.current = 0;
    setDue(false);
    setSkips(0);
  }
  return { due, until, skips, shouldRest, returned, snooze };
}
