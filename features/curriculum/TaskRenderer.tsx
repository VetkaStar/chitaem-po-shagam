import { useRef, useState } from 'react';
import type { TaskRendererProps } from './renderers/types.js';
import { ReadTask } from './renderers/ReadTask.js';
import { ChoiceTask } from './renderers/ChoiceTask.js';
import { ComposeTask } from './renderers/ComposeTask.js';
import { BoundaryTask } from './renderers/BoundaryTask.js';
import { FindPartTask } from './renderers/FindPartTask.js';
import { TransformTask } from './renderers/TransformTask.js';
import { PassageTask } from './renderers/PassageTask.js';
export type { TaskRendererProps } from './renderers/types.js';
function TaskBody(props: TaskRendererProps) {
  switch (props.task.taskKind) {
    case 'read':
      return <ReadTask {...props} />;
    case 'choice':
    case 'read_meaning':
      return <ChoiceTask {...props} />;
    case 'compose':
      return <ComposeTask {...props} />;
    case 'boundary':
      return <BoundaryTask {...props} />;
    case 'find_part':
      return <FindPartTask {...props} />;
    case 'transform':
      return <TransformTask {...props} />;
    case 'passage':
      return <PassageTask {...props} />;
    default:
      return (
        <p role="status">
          Этот вид задания пока не поддерживается. Задание не засчитано.
        </p>
      );
  }
}
/** One synchronous lock guards Enter, repeated clicks and every task-stage transition. */
export function TaskRenderer(props: TaskRendererProps) {
  const locked = useRef(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    if (props.busy || locked.current) return;
    locked.current = true;
    setPending(true);
    setError('');
    try {
      await action();
    } catch {
      setError('Не удалось сохранить действие. Попробуй ещё раз.');
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  const guarded: TaskRendererProps = {
    ...props,
    busy: props.busy || pending,
    onSubmit: (response) => run(() => props.onSubmit(response)),
    onReading: (reading) => run(() => props.onReading(reading)),
    onReveal: () => run(props.onReveal),
  };
  return (
    <div className="curriculum-task-renderer" aria-busy={guarded.busy}>
      <TaskBody key={props.task.instanceId} {...guarded} />
      {error && (
        <p className="curriculum-save-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
