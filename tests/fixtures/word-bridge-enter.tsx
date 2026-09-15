/** Real lesson state and card, mounted only by the regression browser test. */
import { createRoot } from 'react-dom/client';
import { useLesson } from '../../features/lesson/use-lesson';
import ExerciseCard from '../../features/lesson/ExerciseCard';
import { FreeExposureContext } from '../../features/free-practice/use-free-exposure';
import type { FreeExposure } from '../../lib/curriculum/free-exposure';
import '../../app/globals.css';
let release: (() => void) | undefined;
const exposure = {
  pending: false,
  commit() { exposure.pending = false; release?.(); release = undefined; },
};
function record(input: FreeExposure) {
  if (new URLSearchParams(location.search).has('hold') && (input.texts?.length ?? 0) >= 4) {
    exposure.pending = true;
    return new Promise<void>(resolve => { release = resolve; });
  }
  return Promise.resolve();
}
declare global { interface Window {
  bridgeLesson: ReturnType<typeof useLesson>;
  bridgeExposure: typeof exposure;
} }
window.bridgeExposure = exposure;
function Fixture() {
  const model = useLesson();
  window.bridgeLesson = model;
  return model.ready ? <ExerciseCard model={model} /> : <p>Загрузка</p>;
}
createRoot(document.getElementById('root')!).render(
  <FreeExposureContext.Provider value={record}><Fixture /></FreeExposureContext.Provider>,
);
