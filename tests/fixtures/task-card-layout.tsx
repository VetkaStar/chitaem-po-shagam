/** QA only: real lesson and portal, controllable save latency and microphone UI.
 * No fake recognition result is accepted as evidence of speech accuracy. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AppPortal from '../../features/portal/AppPortal';
import LessonWorkspace from '../../features/lesson/LessonWorkspace';
import { useLesson, type LessonModel } from '../../features/lesson/use-lesson';
import { FreeExposureContext } from '../../features/free-practice/use-free-exposure';
import '../../app/globals.css';

const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
const exposure = {
  hold: false,
  get pending() { return pending.length; },
  commit() { exposure.hold = false; pending.splice(0).forEach(p => p.resolve()); },
  fail() { exposure.hold = false; pending.splice(0).forEach(p => p.reject(new Error('QA controlled save failure'))); },
};
const record = () => exposure.hold
  ? new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
  : Promise.resolve();
type MicView = 'off' | 'loading' | 'listening' | 'waiting' | 'error';
declare global { interface Window {
  qaLesson: LessonModel;
  qaExposure: typeof exposure;
  qaMic: (state: MicView) => void;
} }
window.qaExposure = exposure;
function Fixture() {
  const model = useLesson();
  const [mic, setMic] = useState<MicView>('off');
  window.qaLesson = model;
  window.qaMic = setMic;
  const presented: LessonModel = {
    ...model,
    supported: true,
    lessonMic: mic !== 'off',
    listening: mic === 'listening',
    loadingSpeech: mic === 'loading',
    cooldown: mic === 'waiting',
    micLevel: mic === 'listening' ? 0.4 : 0,
    spectrum: Array.from({ length: 12 }, () => mic === 'listening' ? 0.6 : 0),
    attemptStatus: mic === 'error' ? 'Не удалось включить микрофон. Попробуй ещё раз.' : '',
    listen: () => setMic(value => value === 'off' ? 'loading' : 'off'),
  };
  return <AppPortal model={presented}>{onAnswer =>
    <FreeExposureContext.Provider value={record}>
      <LessonWorkspace model={presented} onAnswer={onAnswer} />
    </FreeExposureContext.Provider>
  }</AppPortal>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
