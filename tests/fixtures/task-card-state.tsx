import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { useLesson } from '../../features/lesson/use-lesson';
import ExerciseCard from '../../features/lesson/ExerciseCard';
import { FreeExposureContext } from '../../features/free-practice/use-free-exposure';
import '../../app/globals.css';

// Real lesson state and durable exposure boundary; microphone is a presentation
// fixture, so the geometry test never opens a physical recording device.
let release: (() => void) | undefined;
const gate = {
  hold: false,
  pending: false,
  commit() {
    gate.hold = false;
    gate.pending = false;
    release?.();
    release = undefined;
  },
};
declare global {
  interface Window {
    cardLesson: ReturnType<typeof useLesson>;
    cardGate: typeof gate;
    cardMic: (active: boolean) => void;
  }
}
window.cardGate = gate;
function Fixture() {
  const model = useLesson();
  const [mic, setMic] = useState(false);
  window.cardLesson = model;
  window.cardMic = setMic;
  return (
    <section className="lesson">
      {model.ready && (
        <ExerciseCard
          model={{
            ...model,
            lessonMic: mic,
            listening: mic,
            listen: () => setMic((v) => !v),
            supported: true,
            loadingSpeech: false,
            attemptStatus: mic ? 'Я слушаю' : '',
            spectrum: Array(12).fill(0.4),
          }}
        />
      )}
    </section>
  );
}
createRoot(document.getElementById('root')!).render(
  <FreeExposureContext.Provider
    value={() => {
      if (!gate.hold) return Promise.resolve();
      gate.pending = true;
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    }}
  >
    <Fixture />
  </FreeExposureContext.Provider>,
);
