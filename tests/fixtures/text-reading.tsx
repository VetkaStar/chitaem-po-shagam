import LessonHeader from '../../features/lesson/LessonHeader';
import { useState } from 'react';
import TextLibrary from '../../features/library/TextLibrary';
import TextExercise from '../../features/library/TextExercise';
import { readingTexts } from '../../content/reading-library';
import { createRoot } from 'react-dom/client';
import AppPortal from '../../features/portal/AppPortal';
import LessonWorkspace from '../../features/lesson/LessonWorkspace';
import { useLesson } from '../../features/lesson/use-lesson';
import { FreeExposureContext } from '../../features/free-practice/use-free-exposure';
import type { FreeExposure } from '../../lib/curriculum/free-exposure';
import '../../app/globals.css';
const pending: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];
const recorder = { hold: false, inputs: [] as FreeExposure[], get pending() { return pending.length; },
  commit() { recorder.hold = false; pending.splice(0).forEach(p => p.resolve()); },
  fail() { recorder.hold = false; pending.splice(0).forEach(p => p.reject(Error('controlled failure'))); },
};
const record = (input: FreeExposure) => { recorder.inputs.push(input); return recorder.hold
  ? new Promise<void>((resolve, reject) => pending.push({ resolve, reject })) : Promise.resolve(); };
const longItem = {...readingTexts[0], id:'long-test',title:'Длинный абзац',lines:[Array.from({length:70},(_,i) => `Аня посадила семечко номер ${i}. `).join(''), 'Конец рассказа.']};
function Fixture() {
  const model = useLesson();
  const [controlled, setControlled] = useState(false);
  const [long, setLong] = useState(false);
  Object.assign(window, { textTest: { model, recorder, answer: readingTexts[0].answer, control: () => setControlled(true), long: () => { setLong(true); setControlled(true); } } });
  return <FreeExposureContext.Provider value={record}>{controlled ? <div className="app-root calm" data-audio={model.settings.sound ? 'on' : 'off'}><LessonHeader model={model} onHome={() => {}} onCabinet={() => {}} onMenu={() => {}} /><div className="app-layout"><aside className="app-nav"/><main className="app-content">{long ? <section className="lesson library"><TextExercise model={model} item={longItem} onBack={() => {}} /></section> : <TextLibrary kind="stories" model={model}/>}</main></div></div> : <AppPortal model={model}>{onAnswer =>
    <LessonWorkspace model={model} onAnswer={onAnswer} />
  }</AppPortal>}</FreeExposureContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
