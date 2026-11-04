/** QA: real AppPortal/TextLibrary/TextExercise and useLesson. The browser runner
 * supplies synthetic text, a speech transport stub, and a delayed real recorder. */
import { createRoot } from 'react-dom/client';
import AppPortal from '../../features/portal/AppPortal';
import LessonWorkspace from '../../features/lesson/LessonWorkspace';
import { useLesson, type LessonModel } from '../../features/lesson/use-lesson';
import type { ReadingText } from '../../content/reading-library';
import '../../app/globals.css';

type QaText = {
  model?: LessonModel;
  material: ReadingText;
  hold: boolean;
  waiters: Array<() => void>;
  rejects: Array<(error: Error) => void>;
  requested: Array<{ texts?: string[]; promptedTexts?: string[] }>;
  committed: Array<{ texts?: string[]; promptedTexts?: string[] }>;
  spoken: string[];
  release: () => void;
  fail: () => void;
};
declare global { interface Window { qaText: QaText } }
const initial = window.qaText;
window.qaText = {
  ...initial, hold: false, waiters: [], rejects: [], requested: [], committed: [], spoken: [],
  release() { this.hold=false; this.rejects=[]; this.waiters.splice(0).forEach(resolve=>resolve()); },
  fail() { this.hold=false; this.waiters=[]; this.rejects.splice(0).forEach(reject=>reject(new Error('QA durable save rejected'))); },
};
function Fixture() {
  const model=useLesson();
  window.qaText.model=model;
  const presented: LessonModel={...model,supported:true,speak:text=>window.qaText.spoken.push(text)};
  return <AppPortal model={presented}>{onAnswer=><LessonWorkspace model={presented} onAnswer={onAnswer} />}</AppPortal>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
