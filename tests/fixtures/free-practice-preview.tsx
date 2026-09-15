import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FreeExposureContext,
  useFreeExposure,
} from '../../features/free-practice/use-free-exposure';
import { FreeExposureFrame } from '../../features/free-practice/FreeExposureFrame';
import {
  beforeFreeSpeech,
  setFreeAudioRecorder,
} from '../../features/free-practice/audio';
import {
  freeMaterialReady,
  subscribeMaterialReady,
} from '../../features/free-practice/material-ready';
import type { FreeExposure } from '../../lib/curriculum/free-exposure';
import WordBridge from '../../features/lesson/WordBridge';
import '../../app/globals.css';

type Pending = {
  input: FreeExposure;
  resolve: () => void;
  reject: (error: Error) => void;
};
const pending: Pending[] = [];
const calls: FreeExposure[] = [];
const readiness: boolean[] = [];
const spoken: string[] = [];
function record(input: FreeExposure) {
  calls.push(input);
  return new Promise<void>((resolve, reject) =>
    pending.push({ input, resolve, reject }),
  );
}
const harness = {
  snapshot: () => ({
    calls,
    pending: pending.map((entry) => entry.input),
    ready: freeMaterialReady(),
    readiness,
    spoken,
  }),
  commit: () => pending.splice(0).forEach((entry) => entry.resolve()),
  fail: () =>
    pending
      .splice(0)
      .forEach((entry) => entry.reject(new Error('Test storage failure'))),
  say: (text: string, target?: string) => {
    const saved = beforeFreeSpeech(text, target);
    if (saved) void saved.then(() => spoken.push(text));
    else spoken.push(text);
  },
};
declare global {
  interface Window {
    freePracticeHarness: typeof harness;
  }
}
window.freePracticeHarness = harness;
setFreeAudioRecorder(record);
subscribeMaterialReady(() => readiness.push(freeMaterialReady()));
function ChildState() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((value) => value + 1)}>
      Счётчик {count}
    </button>
  );
}
function Material() {
  const [text, setText] = useState('КОТ');
  const exposure = useFreeExposure({ texts: [text] });
  return (
    <main>
      <button
        onClick={() => setText((value) => (value === 'КОТ' ? 'ДОМ' : 'КОТ'))}
      >
        Сменить материал
      </button>
      <FreeExposureFrame {...exposure}>
        <h1>{text}</h1>
        <ChildState />
        <WordBridge unit={2} target="МУ" sound={false} speak={() => {}} />
      </FreeExposureFrame>
    </main>
  );
}
const standalone = new URLSearchParams(location.search).has('standalone');
createRoot(document.getElementById('root')!).render(
  standalone ? (
    <Material />
  ) : (
    <FreeExposureContext.Provider value={record}>
      <Material />
    </FreeExposureContext.Provider>
  ),
);
