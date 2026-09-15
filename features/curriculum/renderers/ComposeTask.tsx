import { useState } from 'react';
import type { TaskRendererProps } from './types.js';
export function ComposeTask({ task, busy, onSubmit }: TaskRendererProps) {
  const [ids, setIds] = useState<string[]>([]);
  const text = ids
    .map((id) => task.tokens.find((token) => token.tokenId === id)?.text ?? '')
    .join(task.joiner);
  return (
    <form
      className="curriculum-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && ids.length === task.tokens.length && ids.length)
          void onSubmit({ tokenIds: ids });
      }}
    >
      <fieldset disabled={busy}>
        <legend>Выбери части по порядку</legend>
        <div className="curriculum-token-bank">
          {task.tokens.map((token, index) => (
            <button
              type="button"
              key={token.tokenId}
              disabled={busy || ids.includes(token.tokenId)}
              aria-label={'Часть ' + (index + 1) + ': ' + token.text}
              onClick={() =>
                setIds((current) =>
                  current.includes(token.tokenId)
                    ? current
                    : [...current, token.tokenId],
                )
              }
            >
              {token.text}
            </button>
          ))}
        </div>
        <output className="curriculum-composition" aria-live="polite">
          {text || 'Здесь появится собранное слово'}
        </output>
        <div className="curriculum-actions">
          <button
            type="button"
            disabled={busy || !ids.length}
            onClick={() => setIds((current) => current.slice(0, -1))}
          >
            Убрать последнюю часть
          </button>
          <button
            type="button"
            disabled={busy || !ids.length}
            onClick={() => setIds([])}
          >
            Начать заново
          </button>
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={busy || !ids.length || ids.length !== task.tokens.length}
      >
        Ответить
      </button>
    </form>
  );
}
