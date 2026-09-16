import type { ReactNode, RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
export default function NextExerciseButton({
  buttonRef,
  onNext,
  disabled = false,
  countdown,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onNext: () => void;
  disabled?: boolean;
  countdown?: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      className="primary next-exercise-button"
      disabled={disabled}
      onClick={onNext}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.repeat) event.preventDefault();
      }}
    >
      <span>
        Дальше<span className="key-hint"> · Enter</span>
      </span>{' '}
      <ArrowRight />
      {countdown}
    </button>
  );
}
