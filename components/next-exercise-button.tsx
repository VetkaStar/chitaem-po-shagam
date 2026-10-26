import type { ReactNode, RefObject } from 'react';
import { ArrowRight } from 'lucide-react';
export default function NextExerciseButton({
  buttonRef,
  onNext,
  disabled = false,
  countdown,
  label = 'Дальше',
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  onNext: () => void;
  disabled?: boolean;
  countdown?: ReactNode;
  label?: string;
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
        {label}<span className="key-hint"> · Enter</span>
      </span>{' '}
      <ArrowRight />
      {countdown}
    </button>
  );
}
