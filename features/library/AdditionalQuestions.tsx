import { useEffect, useState } from 'react';
import AnswerEntry from '../answers/AnswerEntry';
import type { LessonModel } from '../lesson/use-lesson';

export function useAdditionalQuestions(kind: string, unit: number) {
  const [available, setAvailable] = useState(false);
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    setSelected(false);
    if (kind === 'sentences') {
      void Promise.all([
        import('../../lib/curriculum/bundled'),
        import('../answers/session'),
      ])
        .then(async ([bank, answers]) => {
          const supply = await bank.loadBundledSupply();
          if (!cancelled)
            setAvailable(
              answers.answerItems(supply, unit, 'sentences').length > 0,
            );
        })
        .catch(() => {
          if (!cancelled) setAvailable(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [kind, unit]);
  return { available, selected, setSelected };
}

export function QuestionSource({
  selected,
  onChange,
}: {
  selected: boolean;
  onChange: (selected: boolean) => void;
}) {
  return (
    <div
      className="mode-list question-sources"
      role="group"
      aria-label="Набор вопросов"
    >
      <button aria-pressed={!selected} onClick={() => onChange(false)}>
        Вопросы к тексту
      </button>
      <button aria-pressed={selected} onClick={() => onChange(true)}>
        Дополнительные вопросы
      </button>
    </div>
  );
}

export default function AdditionalQuestions({ model }: { model: LessonModel }) {
  return <AnswerEntry model={model} section="sentences" />;
}
