import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const selectedVoices = [];
const audios = [],
  tasks = [],
  revoked = [],
  errors = [];
let ends = 0,
  cancelled = 0;
const module = { exports: {} };
vm.runInNewContext(
  ts.transpile(fs.readFileSync('lib/piper-speech.ts', 'utf8'), {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  }),
  {
    module,
    exports: module.exports,
    require: () => ({
      generatePiper: (_text, _status, voice) => { selectedVoices.push(voice); return new Promise((resolve) => tasks.push(resolve)); },
      cancelPiperGeneration: () => {
        cancelled++;
      },
    }),
    Audio: class {
      constructor() {
        audios.push(this);
      }
      play() {
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
      removeAttribute() {
        this.src = '';
      }
      load() {}
    },
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: (url) => revoked.push(url),
    },
  },
);
const { speakPiper, stopPiperSpeech } = module.exports;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const options = {
  slow: false,
  onEnd: () => ends++,
  onError: (e) => errors.push(e),
};
const stop = speakPiper('Маша', options);
await tick();
stop();
tasks.shift()(new Blob(['wave']));
await tick();
assert.equal(
  audios[0].src,
  '',
  'cancelled generation must never begin playback',
);
assert.equal(ends, 0);
speakPiper('Шишка', { ...options, slow: true });
await tick();
tasks.shift()(new Blob(['wave']));
await tick();
assert.equal(audios[1].src, 'blob:test');
assert.equal(audios[1].preservesPitch, true);
assert.equal(audios[1].playbackRate, 0.8);
audios[1].onended();
assert.equal(ends, 1);
assert.equal(audios[1].src, '');
assert.deepEqual(revoked, ['blob:test']);
speakPiper('Жук', options);
stopPiperSpeech();
await tick();
assert.equal(
  tasks.length,
  0,
  'cancel before lazy import must not start worker',
);
assert.equal(cancelled, 2);
assert.deepEqual(errors, []);
console.log(
  'PASS Piper playback: cancellation during/before generation, slow playback preserves pitch, ended cleanup and URL release',
);

for (const narrator of ['piper-denis', 'piper-dmitri', 'piper-ruslan']) {
  speakPiper('Мама', { ...options, narrator });
  await tick();
  assert.equal(selectedVoices.at(-1), narrator);
  tasks.shift()(new Blob(['wave']));
  await tick();
  audios.at(-1).onended();
}
console.log('PASS selected male voices reach the generation worker facade');

for (const [rate, expected] of [[0.5,0.5],[1.3,1.3],[5,1.5],[NaN,1]]) {
 const cancel = speakPiper('Мама', {...options, rate});
 assert.equal(audios.at(-1).playbackRate, expected);
 assert.equal(audios.at(-1).preservesPitch,true);
 cancel();
}
console.log('PASS narration speed and bounds preserve pitch');
