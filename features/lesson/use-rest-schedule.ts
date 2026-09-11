'use client';
import { useEffect, useRef, useState } from 'react';
import { breakDue } from '@/lib/breaks';
export function useRestSchedule(
  active: boolean,
  every: number,
  minutes: number,
) {
  const lastActivity = useRef<number | null>(null);
  const elapsed = useRef(0),
    [due, setDue] = useState(false),
    [until, setUntil] = useState(0),
    [snoozed, setSnoozed] = useState(false),
    [skips, setSkips] = useState(0);
  // A new rest frequency starts counting from zero.
  const [frequency, setFrequency] = useState({ every, minutes });
  if (frequency.every !== every || frequency.minutes !== minutes) {
    setFrequency({ every, minutes });
    setDue(false);
  }
  useEffect(() => {
    elapsed.current = 0;
  }, [every, minutes]);
  useEffect(() => {
    if (!active) lastActivity.current = null;
    if (!active || !minutes) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      if (
        !document.hidden &&
        now >= until &&
        lastActivity.current !== null &&
        now - lastActivity.current <= 30000
      )
        elapsed.current += Math.min(now - last, 2000);
      last = now;
      if (elapsed.current >= minutes * 60000) setDue(true);
    }, 1000);
    return () => clearInterval(id);
  }, [active, minutes, until]);
  useEffect(() => {
    if (!snoozed) return;
    const id = setInterval(() => {
      if (Date.now() >= until) setSnoozed(false);
    }, 1000);
    return () => clearInterval(id);
  }, [snoozed, until]);
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
    setSnoozed(true);
    elapsed.current = 0;
    setDue(false);
    setSkips(0);
  }
  function touch() {
    lastActivity.current = Date.now();
  }
  function suspend() {
    lastActivity.current = null;
  }
  return {
    due,
    until,
    snoozed,
    skips,
    shouldRest,
    returned,
    snooze,
    touch,
    suspend,
  };
}
