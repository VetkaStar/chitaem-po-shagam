/** Browser-only fixture; no curriculum engine or production entry imports. */
import { createRoot } from 'react-dom/client';
import { TaskRenderer } from '../../features/curriculum/TaskRenderer';
import type { TaskPresentation } from '../../features/curriculum/presentation';

const params = new URLSearchParams(location.search);
const kind = params.get('kind') ?? 'choice';
const revealed = params.get('revealed') !== 'false';
const finished = params.get('finished') !== 'false';
const busy = params.get('busy') === 'true';
const sound = params.get('sound') !== 'false';
const task: TaskPresentation = {
  kind: 'task', instanceId: 'audio-fixture', taskKind: kind,
  instruction: 'Выбери ответ', taskInstruction: 'Выбери ответ',
  transformFollowup: false, text: 'Кот спит.', lines: ['Кот спит.'], mode: 'read',
  answerKind: kind === 'passage' ? 'question_set' : 'choice',
  readingStageFinished: finished, optionsRevealed: revealed,
  options: revealed ? [{ id: 'same', text: 'Кот' }, { id: 'other', text: 'Пёс' }] : [],
  questions: revealed ? [
    { id: 'q1', prompt: 'Кто спит?', options: [{ id: 'same', text: 'Кот' }] },
    { id: 'q2', prompt: 'Что делает кот?', options: [{ id: 'same', text: 'Спит' }] },
  ] : [],
  tokens: [], joiner: '', selectedAnswers: {}, helpLevel: 0, hints: [],
  canRequestHint: false, functionCheck: null,
};
const events: { spoken: (string | null)[][]; submitted: unknown[]; reveals: number; readings: number } = {
  spoken: [], submitted: [], reveals: 0, readings: 0,
};
declare global { interface Window { optionAudioEvents: typeof events } }
window.optionAudioEvents = events;
createRoot(document.getElementById('root')!).render(
  <TaskRenderer
    task={task}
    busy={busy}
    onSubmit={async response => { events.submitted.push(response); }}
    onReveal={async () => { events.reveals++; }}
    onReading={async () => { events.readings++; }}
    onSpeak={sound ? (questionId, optionId) => { events.spoken.push([questionId, optionId]); } : undefined}
  />,
);
