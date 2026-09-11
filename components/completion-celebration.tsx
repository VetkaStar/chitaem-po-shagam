'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './completion-celebration.css';

/** A brief, non-blocking reward; completion text remains in the game. */
export default function CompletionCelebration({
  done,
  motion,
}: {
  done: boolean;
  motion: boolean;
}) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setExpired(true), 2000);
    return () => {
      clearTimeout(timer);
      setExpired(false);
    };
  }, [done]);
  if (!done || expired) return null;
  return createPortal(
    <div
      className="completion-celebration"
      data-motion={motion}
      aria-hidden="true"
    >
      <div className="completion-card">
        <div className="completion-stars">★ ✦ ★</div>
        <strong>Молодец!</strong>
        <span>У тебя получилось!</span>
      </div>
    </div>,
    document.body,
  );
}
