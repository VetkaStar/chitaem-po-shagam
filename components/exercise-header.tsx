import { Volume2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function ExerciseHeader({
  number,
  total,
  completed,
  sound,
  speaking,
  onSpeak,
}: {
  number: number;
  total: number;
  completed: number;
  sound: boolean;
  speaking: boolean;
  onSpeak: () => void;
}) {
  return (
    <>
      <div className="exercise-top">
        <span>
          Задание {number} из {total}
        </span>
        {sound && (
          <button
            className="quiet"
            onClick={onSpeak}
            disabled={speaking}
            aria-label="Озвучить задание"
          >
            <Volume2 size={21} />
          </button>
        )}
      </div>
      <Progress
        value={total > 0 ? (completed / total) * 100 : 0}
        aria-label="Прогресс занятия"
        className="lesson-progress"
      />
    </>
  );
}
