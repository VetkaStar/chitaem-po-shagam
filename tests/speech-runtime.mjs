import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const sessions = [];
let processor,
  constraints,
  stopped = 0;
const load = (name) => {
  if (name.endsWith('worker-client'))
    return {
      claimWorker(model, lane) {
        const tasks = [];
        const session = {
          tasks,
          model,
          lane,
          request(kind, reply, samples, rate) {
            if (kind === 'load' || kind === 'reset') return Promise.resolve();
            return new Promise((resolve, reject) =>
              tasks.push({ kind, reply, samples, rate, resolve, reject }),
            );
          },
          release() {},
        };
        sessions.push(session);
        return session;
      },
    };
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(name + '.ts', 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
    {
      module,
      exports: module.exports,
      require: (p) => load(path.resolve(path.dirname(name), p)),
      Float32Array,
      performance,
      setTimeout,
      clearTimeout,
      AudioContext: class {
        sampleRate = 16000;
        state = 'running';
        async resume() {}
        async close() {
          this.state = 'closed';
        }
        createMediaStreamSource() {
          return { connect() {}, disconnect() {} };
        }
        createAnalyser() {
          return {
            frequencyBinCount: 256,
            getByteFrequencyData() {},
            disconnect() {},
          };
        }
        createScriptProcessor() {
          processor = { connect() {}, disconnect() {}, onaudioprocess: null };
          return processor;
        }
      },
      navigator: {
        mediaDevices: {
          async getUserMedia(value) {
            constraints = value.audio;
            return {
              getTracks: () => [
                {
                  stop() {
                    stopped++;
                  },
                },
              ],
              getAudioTracks: () => [{ getSettings: () => value.audio }],
            };
          },
        },
      },
    },
  );
  return module.exports;
};
const { speechModels, parseSpeechModel, microphoneConstraints } =
  load('lib/speech/models');
assert.equal(speechModels.length, 7);
assert.equal(parseSpeechModel('unknown'), 'vosk');
assert.equal(parseSpeechModel('gigaam-ctc-int8'), 'gigaam-ctc-int8');
for (const enabled of [true, false]) {
  const value = microphoneConstraints('chosen', enabled);
  assert.equal(value.noiseSuppression, enabled);
  assert.equal(value.echoCancellation, enabled);
  assert.equal(value.autoGainControl, enabled);
  assert.equal(value.deviceId.exact, 'chosen');
}
const { SpeechSegments } = load('lib/speech/segments');
const segments = new SpeechSegments(16000);
for (let i = 0; i < 30; i++)
  assert.equal(segments.push(new Float32Array(1600)), null);
assert.equal(
  segments.finish(),
  null,
  'silence must never trigger transcription',
);
segments.push(new Float32Array(1600).fill(0.1));
let result;
for (let i = 0; i < 8; i++) result = segments.push(new Float32Array(1600));
assert(result.length >= 14400, 'short syllable and trailing silence retained');
segments.push(new Float32Array(1600).fill(0.1));
segments.reset();
assert.equal(segments.finish(), null, 'reset discards previous attempt');
const { gigaamFeatures } = load('lib/speech/gigaam-features');
const silence = gigaamFeatures(new Float32Array(16000));
assert.equal(
  silence.frames,
  99,
  'v3 320 sample window, 160 sample hop, no centering',
);
assert.equal(silence.features.length, 64 * 99);
assert(Math.abs(silence.features[0] - Math.log(1e-9)) < 1e-5);
const { startBrowserSpeech } = load('lib/speech/browser-session');
const finals = [],
  errors = [];
let signalReady;
const prepared = new Promise((resolve) => {
  signalReady = resolve;
});
const engine = startBrowserSpeech({
  speechModel: 'gigaam-ctc-int8',
  micProcessing: false,
  deviceId: 'chosen',
  onReady: signalReady,
  onLevel() {},
  onPartial() {},
  onStatus() {},
  onResult: (r) => finals.push(r),
  onError: (e) => errors.push(e),
});
await prepared;
assert.equal(constraints.noiseSuppression, false);
const audio = (value) =>
  processor.onaudioprocess({
    inputBuffer: { getChannelData: () => new Float32Array(4096).fill(value) },
  });
audio(0.1);
for (let i = 0; i < 4; i++) audio(0);
const old = sessions[0].tasks[0];
assert(old, 'segment reaches model');
engine.setEnabled(false);
old.reply({ result: { text: 'ша', final: true } });
old.resolve();
await Promise.resolve();
assert.equal(finals.length, 0, 'late result during pause rejected');
engine.setEnabled(true);
audio(0.1);
const finish = engine.finish();
const current = sessions[0].tasks.at(-1);
current.reply({ result: { text: 'ша', final: true } });
current.resolve();
await finish;
assert.equal(finals.length, 1);
assert.equal(finals[0].experimental, true);
assert.equal(
  finals[0].result,
  undefined,
  'never invent Vosk confidence for another model',
);
assert.equal(stopped, 1, 'finish closes microphone');
current.reply({ result: { text: 'late', final: true } });
assert.equal(finals.length, 1, 'finished session rejects stale result');
assert.deepEqual(errors, []);
console.log(
  'PASS speech models: selection, raw microphone constraints, silence/short syllables, v3 features, pause, final drain, cleanup and no fabricated confidence.',
);

assert.equal(
  parseSpeechModel('combined:gigaam-ctc-int8'),
  'combined:gigaam-ctc-int8',
);
assert.equal(parseSpeechModel('combined:vosk'), 'vosk');
const previews = [],
  combinedFinals = [];
let combinedReady;
const readyBoth = new Promise((resolve) => {
  combinedReady = resolve;
});
const base = sessions.length;
const both = startBrowserSpeech({
  speechModel: 'combined:gigaam-ctc-int8',
  onReady: combinedReady,
  onLevel() {},
  onStatus() {},
  onPartial: (t) => previews.push(t),
  onResult: (r) => combinedFinals.push(r),
  onError: (e) => errors.push(e),
});
await readyBoth;
const fast = sessions.slice(base).find((s) => s.lane === 'preview');
const verifier = sessions
  .slice(base)
  .find((s) => s.model === 'gigaam-ctc-int8');
assert.equal(fast.model, 'zipformer-int8');
audio(0.1);
fast.tasks[0].reply({ result: { text: 'ма', final: false } });
assert.equal(previews.at(-1), 'ма');
assert.equal(combinedFinals.length, 0);
fast.tasks[0].reply({ result: { text: 'мама', final: true } });
assert.equal(combinedFinals.length, 0, 'fast finals never award');
for (let i = 0; i < 4; i++) audio(0);
assert.equal(
  verifier.tasks.length,
  1,
  'same captured audio reaches verifier after pause',
);
verifier.tasks[0].reply({ result: { text: 'мама', final: true } });
assert.equal(combinedFinals.length, 1);
assert.equal(combinedFinals[0].model, 'gigaam-ctc-int8');
const previewCount = previews.length;
fast.tasks[0].reply({ result: { text: 'запоздалое', final: false } });
assert.equal(
  previews.length,
  previewCount,
  'confirmed segment ignores late fast preview',
);
both.setEnabled(false);
fast.tasks.at(-1).reply({ result: { text: 'пауза', final: true } });
verifier.tasks[0].reply({ result: { text: 'пауза', final: true } });
assert.equal(previews.length, previewCount);
assert.equal(combinedFinals.length, 1);
both.abort();
assert.equal(stopped, 2, 'combined session owns just one capture');
for (const session of [fast, verifier])
  for (const task of session.tasks) task.resolve();
await Promise.resolve();
assert.deepEqual(errors, []);
console.log(
  'PASS combined: single capture, early preview, verifier-only finals, stale preview and pause isolation',
);
