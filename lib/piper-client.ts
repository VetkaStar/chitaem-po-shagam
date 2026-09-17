import { piperVoiceId, type Narrator } from './narrator-models';
let selectedVoice: string | undefined;
let worker: Worker | undefined;
let serial = 0;
let idle: ReturnType<typeof setTimeout> | undefined;
let pending:
  | {
      id: number;
      resolve: (blob: Blob) => void;
      reject: (error: Error) => void;
      status: (text: string) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  | undefined;
function dispose(error = new Error('ABORTED')) {
  clearTimeout(idle);
  worker?.terminate();
  worker = undefined;
  if (pending) {
    clearTimeout(pending.timer);
    pending.reject(error);
    pending = undefined;
  }
}
export function cancelPiperGeneration() {
  if (pending) dispose();
}
export function generatePiper(
  text: string,
  status: (text: string) => void,
  narrator: Narrator = 'piper-irina',
): Promise<Blob> {
  const voiceId = piperVoiceId(narrator);
  if (!voiceId) return Promise.reject(new Error('Не выбран голос Piper.'));
  if (pending || selectedVoice !== voiceId) dispose();
  selectedVoice = voiceId;
  clearTimeout(idle);
  worker ??= new Worker(new URL('./piper.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onerror = (event) =>
    dispose(new Error(event.message || 'Не удалось запустить голос.'));
  worker.onmessage = ({ data }) => {
    if (!pending || pending.id !== data.id) return;
    if (data.status) pending.status(data.status);
    if (data.error) {
      dispose(new Error(data.error));
      return;
    }
    if (data.wav) {
      const task = pending;
      pending = undefined;
      clearTimeout(task.timer);
      idle = setTimeout(() => dispose(), 60000);
      task.resolve(data.wav);
    }
  };
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending = {
      id,
      resolve,
      reject,
      status,
      timer: setTimeout(
        () =>
          dispose(
            new Error(
              'Голос не успел загрузиться или подготовить речь. Попробуйте ещё раз.',
            ),
          ),
        180000,
      ),
    };
    worker!.postMessage({ id, text, voiceId });
  });
}
