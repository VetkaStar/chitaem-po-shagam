import { useState } from 'react';
import type { TaskRendererProps } from './types.js';
import { OptionButtons } from './OptionButtons.js';
import { ReadingStage } from './ReadingStage.js';
export function ChoiceTask(props: TaskRendererProps) {
  const { task, busy, onSubmit, onReveal, onSpeak } = props;
  const [selected, setSelected] = useState<string[]>([]);
  if (
    task.taskKind === 'read_meaning' &&
    (!task.readingStageFinished || !task.optionsRevealed)
  )
    return <ReadingStage {...props} />;
  if (!task.optionsRevealed)
    return (
      <button type="button" disabled={busy} onClick={() => void onReveal()}>
        Открыть варианты ответа
      </button>
    );
  return (
    <form
      className="curriculum-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && selected.length) void onSubmit({ optionIds: selected });
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {task.answerKind === 'ordered_ids'
            ? 'Выбери варианты по порядку'
            : 'Выбери подходящие варианты'}
        </legend>
        <OptionButtons
          compactAudio={props.compactAudio}
          options={task.options}
          selected={selected}
          busy={busy}
          onChange={setSelected}
          onSpeak={onSpeak ? (optionId) => onSpeak(null, optionId) : undefined}
        />
        {task.answerKind === 'ordered_ids' && (
          <ol className="curriculum-selection">
            {selected.map((id) => (
              <li key={id}>
                {task.options.find((option) => option.id === id)?.text}
              </li>
            ))}
          </ol>
        )}
      </fieldset>
      <button type="submit" disabled={busy || selected.length === 0}>
        Ответить
      </button>
    </form>
  );
}
