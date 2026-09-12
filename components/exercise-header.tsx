import { Leaf, Volume2 } from 'lucide-react';
import './exercise-header.css';

/** Task counter, one bar per task and the rest reminder. */
export default function ExerciseHeader({
  number,
  total,
  completed,
  label,
  rest,
  sound = false,
  speaking = false,
  onSpeak,
}: {
  number: number;
  total: number;
  completed: number;
  label?: string;
  rest?: string;
  sound?: boolean;
  speaking?: boolean;
  onSpeak?: () => void;
}) {
  return (
    <div className="exercise-top" data-number={number}>
      <span className="exercise-count">
        {label ?? `Задание ${number} из ${total}`}
      </span>
      <div
        className="lesson-bars"
        role="progressbar"
        aria-label="Прогресс занятия"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(completed, total)}
      >
        {Array.from({ length: total }, (_, i) => (
          <i
            key={i}
            data-state={
              i < completed ? 'done' : i === completed ? 'now' : 'todo'
            }
          />
        ))}
      </div>
      {rest && (
        <span className="exercise-rest">
          <Leaf size={15} aria-hidden="true" />
          {rest}
        </span>
      )}
      {sound && onSpeak && (
        <button
          className="speak-button"
          onClick={onSpeak}
          disabled={speaking}
          aria-label="Озвучить задание"
        >
          <Volume2 size={18} />
        </button>
      )}
    </div>
  );
}
