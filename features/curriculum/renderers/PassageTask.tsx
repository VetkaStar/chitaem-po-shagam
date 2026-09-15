import type { TaskRendererProps } from './types.js';
import { ReadingStage } from './ReadingStage.js';
import { PassageQuestion } from './PassageQuestion.js';
export function PassageTask(props: TaskRendererProps) {
  const { task, busy, onSubmit } = props;
  if (!task.readingStageFinished || !task.optionsRevealed)
    return <ReadingStage {...props} />;
  return (
    <section className="curriculum-questions" aria-label="Вопросы к тексту">
      {task.questions.map((question) => (
        <PassageQuestion
          key={question.id}
          question={question}
          saved={task.selectedAnswers[question.id] ?? []}
          busy={busy}
          onSave={(ids) => onSubmit({ answers: { [question.id]: ids } })}
        />
      ))}
    </section>
  );
}
