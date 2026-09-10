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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!done) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [done]);
  if (!done || !visible) return null;
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
