import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  ts = require('typescript');
const spoken = [],
  neural = [],
  writes = [],
  pending = [];
const synthesis = {
  cancel() {},
  getVoices() {
    return [];
  },
  speak(u) {
    spoken.push(u.text);
  },
};
const cache = new Map();
function load(relative) {
  const file = path.resolve(relative);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(file, 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
    {
      module,
      exports: module.exports,
      Set,
      Promise,
      console,
      window: { speechSynthesis: synthesis },
      speechSynthesis: synthesis,
      SpeechSynthesisUtterance: function (text) {
        this.text = text;
      },
      require(p) {
        if (p.endsWith('/piper-speech'))
          return {
            stopPiperSpeech() {},
            speakPiper: (text, options) => neural.push({ text, options }),
          };
        if (p.includes('narrator-voice'))
          return { selectNarratorVoice: () => undefined };
        return load(
          path.resolve(path.dirname(file), p.replace(/\.js$/, '')) + '.ts',
        );
      },
    },
  );
  return module.exports;
}
const { createVoiceHandler } = load('features/lesson/lesson-voice-actions.ts');
const audio = load('features/free-practice/audio.ts');
audio.setFreeAudioRecorder((input) => {
  writes.push(input);
  return new Promise((resolve, reject) => pending.push({ resolve, reject }));
});
const speechEpoch = { current: 0 };
let errors = 0;
const speak = createVoiceHandler({
  setCooldown() {},
  recognition: { current: null },
  speechEpoch,
  settings: { sound: true, slow: false },
  releaseSoon() {},
  setSpeaking() {},
  onExposureError() {
    errors++;
  },
});
speak('бэ', 'Б');
assert.equal(spoken.length, 0);
assert.deepEqual(Array.from(writes[0].promptedTexts), ['Б']);
speechEpoch.current++;
pending.shift().resolve();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(
  spoken.length,
  0,
  'stop during persistence must cancel obsolete playback',
);
speak('бэ', 'Б');
pending.shift().resolve();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(spoken, ['бэ']);
speak('бэ', 'Б');
pending.shift().reject(new Error('FAIL'));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(spoken.length, 1);
assert.equal(errors, 1);
audio.setFreeAudioRecorder(null);
audio.setFreeAudioRecorder(
  () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
);
const neuralSpeak = createVoiceHandler({
  setCooldown() {},
  recognition: {
    current: { setEnabled: (value) => assert.equal(value, false) },
  },
  speechEpoch,
  settings: { sound: true, slow: false, narrator: 'piper-irina' },
  releaseSoon() {},
  setSpeaking() {},
});
neuralSpeak('Маша', 'МАША');
assert.equal(neural.length, 0, 'Piper waits for durable assistance too');
speechEpoch.current++;
pending.shift().resolve();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(
  neural.length,
  0,
  'cancelled lesson cannot start Piper after saving',
);
neuralSpeak('Шишка', 'ШИШКА');
pending.shift().resolve();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(neural.length, 1);
assert.equal(neural[0].text, 'Шишка');
audio.setFreeAudioRecorder(null);
console.log(
  'PASS free audio: explicit letter target, durable assistance before speech, stale cancellation, visible failure callback',
);
