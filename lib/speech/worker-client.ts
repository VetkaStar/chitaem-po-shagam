import type { SpeechModelId } from './models';
type Reply = {
  id: number;
  status?: string;
  result?: { text: string; final: boolean };
  done?: boolean;
  error?: string;
};
function workerSlot() {
  let worker: Worker | undefined;
  let selected: SpeechModelId | undefined;
  let serial = 0;
  let owner = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<
    number,
    {
      resolve: () => void;
      reject: (error: Error) => void;
      reply: (message: Reply) => void;
    }
  >();
  function dispose() {
    worker?.terminate();
    worker = undefined;
    selected = undefined;
    for (const task of pending.values()) task.reject(new Error('ABORTED'));
    pending.clear();
  }
  function claim(model: SpeechModelId) {
    clearTimeout(idleTimer);
    const token = ++owner;
    if (selected !== model) dispose();
    if (!worker) {
      selected = model;
      worker = new Worker(new URL('./inference.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = ({ data }: MessageEvent<Reply>) => {
        const task = pending.get(data.id);
        if (!task) return;
        task.reply(data);
        if (data.done || data.error) {
          pending.delete(data.id);
          if (data.error) task.reject(new Error(data.error));
          else task.resolve();
        }
      };
      worker.onerror = () => dispose();
    }
    return {
      request(
        kind: 'load' | 'reset' | 'audio' | 'finish',
        reply: (message: Reply) => void = () => {},
        samples?: Float32Array,
        rate?: number,
      ) {
        if (token !== owner || !worker)
          return Promise.reject(new Error('ABORTED'));
        const id = ++serial;
        return new Promise<void>((resolve, reject) => {
          pending.set(id, { resolve, reject, reply });
          worker!.postMessage(
            { id, kind, model, samples, rate },
            samples ? [samples.buffer] : [],
          );
        });
      },
      release(hard = false) {
        if (token !== owner) return;
        if (hard) dispose();
        else idleTimer = setTimeout(dispose, 60000);
      },
    };
  }

  return claim;
}
const primary = workerSlot();
const preview = workerSlot();
export function claimWorker(
  model: SpeechModelId,
  lane: 'primary' | 'preview' = 'primary',
) {
  return (lane === 'preview' ? preview : primary)(model);
}
