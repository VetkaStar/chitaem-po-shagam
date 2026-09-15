import { useEffect, useState } from 'react';
import type { TaskRendererProps } from './types.js';
import { OptionButtons } from './OptionButtons.js';
type Question = TaskRendererProps['task']['questions'][number];
interface Props {
  question: Question;
  saved: string[];
  busy: boolean;
  onSave: (ids: string[]) => Promise<void>;
}
export function PassageQuestion({ question, saved, busy, onSave }: Props) {
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
        <OptionButtons
          options={question.options}
          selected={selected}
          busy={busy}
          onChange={setSelected}
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
