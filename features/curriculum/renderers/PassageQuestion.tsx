import { useEffect, useState } from 'react';
import type { TaskRendererProps } from './types.js';
import { OptionButtons } from './OptionButtons.js';
type Question = TaskRendererProps['task']['questions'][number];
interface Props {
  question: Question;
  number: number;
  onSpeak?: TaskRendererProps['onSpeak'];
  saved: string[];
  busy: boolean;
  onSave: (ids: string[]) => Promise<void>;
}
export function PassageQuestion({
  question,
  number,
  onSpeak,
  saved,
  busy,
  onSave,
}: Props) {
  const [selected, setSelected] = useState<string[]>(saved),
    savedKey = JSON.stringify(saved);
  useEffect(() => {
    setSelected(JSON.parse(savedKey) as string[]);
  }, [savedKey]);
  return (
    <form
      className="curriculum-question"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && selected.length) void onSave(selected);
      }}
    >
      <fieldset disabled={busy}>
        <legend>{question.prompt}</legend>
        {onSpeak && (
          <button
            type="button"
            disabled={busy}
            aria-label={'Послушать вопрос ' + number}
            onClick={() => onSpeak(question.id, null)}
          >
            Послушать вопрос
          </button>
        )}
        <OptionButtons
          options={question.options}
          selected={selected}
          busy={busy}
          onChange={setSelected}
          audioLabel={'вопроса ' + number}
          onSpeak={
            onSpeak ? (optionId) => onSpeak(question.id, optionId) : undefined
          }
        />
      </fieldset>
      <button type="submit" disabled={busy || !selected.length}>
        Сохранить ответ
      </button>
      {saved.length > 0 && JSON.stringify(selected) === savedKey && (
        <p className="curriculum-saved-answer" role="status">
          Ответ сохранён
        </p>
      )}
    </form>
  );
}
