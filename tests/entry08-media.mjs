import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const spoken = [];
const synth = {
  cancel() {},
  getVoices: () => [{ lang: 'ru-RU', name: 'Irina' }],
  speak: (u) => spoken.push(u),
};
const globals = {
  window: { speechSynthesis: synth, AudioContext: class {} },
  navigator: { mediaDevices: { getUserMedia() {} } },
  speechSynthesis: synth,
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
    }
  },
  setTimeout,
  clearTimeout,
};
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(file, 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
    {
      ...globals,
      module,
      exports: module.exports,
      require: (p) => load(path.resolve(path.dirname(file), p) + '.ts'),
    },
  );
  return module.exports;
}
const { createEntryMedia } = load('features/entry08/media.ts');
const captures = [];
const start = (callbacks) => {
  assert.equal(callbacks.vocabulary, undefined, 'no target-word grammar');
  const engine = {
    callbacks,
    aborted: false,
    abort() {
      this.aborted = true;
    },
    finish: async () => {},
  };
  captures.push(engine);
  return engine;
};
const media = createEntryMedia(
  () => ({ sound: true, voice: 'female', slow: true, micDevice: '' }),
  start,
);
assert.equal(spoken.length, 0, 'construction does not autoplay');
let request = media.recognize();
let c = captures.at(-1);
c.callbacks.onPartial('кот');
media.finishRecognition();
assert.equal((await request).error, 'no_speech', 'partial is never a final');
request = media.recognize();
c = captures.at(-1);
c.callbacks.onResult({ text: 'ко', result: [{ conf: 0.93 }] });
c.callbacks.onResult({ text: 'т', result: [{ conf: 0.91 }] });
media.finishRecognition();
let result = await request;
assert.equal(result.transcript, 'ко т');
assert.equal(result.confidence, 0.91);
assert.equal(result.isFinal, true);
request = media.recognize();
c = captures.at(-1);
c.callbacks.onResult({ text: 'кот', experimental: true });
media.finishRecognition();
result = await request;
assert.equal(result.transcript, 'кот');
assert.equal(result.confidence, undefined, 'experimental confidence stays unknown, not zero or fabricated');
request = media.recognize();
c = captures.at(-1);
const canceled = assert.rejects(request, /ABORTED/);
media.stopRecognition();
await canceled;
c.callbacks.onResult({ text: 'устаревшее', result: [{ conf: 1 }] });
request = media.recognize();
c = captures.at(-1);
c.callbacks.onError('denied', 'not-allowed');
assert.equal((await request).error, 'not-allowed');
for (const code of ['audio-capture', 'service_unavailable']) {
  request = media.recognize();
  captures.at(-1).callbacks.onError('failure', code);
  assert.equal((await request).error, code);
}
request = media.recognize();
c = captures.at(-1);
const stopped = assert.rejects(request, /ABORTED/);
const speech = media.speak('Инструкция');
await stopped;
assert.equal(c.aborted, true);
assert.equal(spoken.at(-1).rate, 0.72);
const interrupted = assert.rejects(speech, /ABORTED/);
request = media.recognize();
await interrupted;
media.finishRecognition();
await request;
const speech2 = media.speak('Повтор');
const utterance = spoken.at(-1);
utterance.onend();
await speech2;
assert.equal(utterance.onend, null);
console.log(
  'entry media: final-only accumulation, cancellation, TTS exclusion, error distinctions passed',
);
// Real local-speech wrapper: finish drains queued recognizer replies, including an empty final.
let recorder,
  processor,
  trackStopped = 0;
class Recognizer {
  handlers = {};
  constructor() {
    recorder = this;
  }
  setWords() {}
  on(event, handler) {
    this.handlers[event] = handler;
  }
  acceptWaveform() {}
  retrieveFinalResult() {
    this.flushed = true;
  }
  remove() {
    this.removed = true;
  }
}
class Model {
  KaldiRecognizer = Recognizer;
  on(event, handler) {
    if (event === 'load') queueMicrotask(() => handler({ result: true }));
  }
  terminate() {}
}
const connect = () => ({ connect() {}, disconnect() {} });
class Context {
  state = 'running';
  sampleRate = 48000;
  destination = {};
  async resume() {}
  async close() {
    this.state = 'closed';
  }
  createMediaStreamSource() {
    return connect();
  }
  createAnalyser() {
    return {
      ...connect(),
      fftSize: 512,
      frequencyBinCount: 256,
      getFloatTimeDomainData: (a) => a.fill(0),
      getByteFrequencyData: (a) => a.fill(0),
    };
  }
  createScriptProcessor() {
    processor = { ...connect(), onaudioprocess: null };
    return processor;
  }
}
Object.assign(globals, {
  AudioContext: Context,
  window: { Vosk: { Model } },
  navigator: {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [
          {
            stop() {
              trackStopped++;
            },
          },
        ],
      }),
    },
  },
  document: { baseURI: 'https://example.test/' },
  fetch: async () => ({
    ok: true,
    json: async () => ({ bytes: 0, parts: [] }),
  }),
  URL: class extends URL {
    static createObjectURL() {
      return 'blob:test';
    }
    static revokeObjectURL() {}
  },
  Blob,
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  performance: { now: () => 100 },
});
const { startLocalSpeech } = load('lib/local-speech.ts');
let ready;
const prepared = new Promise((resolve) => (ready = resolve));
const finals = [];
const local = startLocalSpeech({
  onLevel() {},
  onStatus() {},
  onReady: ready,
  onPartial() {},
  onResult: (r) => finals.push(r.text),
  onError: (m) => assert.fail(m),
});
await prepared;
processor.onaudioprocess({ inputBuffer: {} });
const finished = local.finish();
assert.equal(recorder.flushed, true);
recorder.handlers.result({ result: { text: 'кот', result: [{ conf: 0.9 }] } });
assert.equal(
  recorder.removed,
  undefined,
  'queued audio reply must not close before flush reply',
);
recorder.handlers.result({ result: { text: '' } });
await finished;
assert.equal(recorder.removed, true);
assert.equal(trackStopped, 1);
recorder.handlers.result({ result: { text: 'late' } });
assert.deepEqual(finals, ['кот']);
console.log(
  'local Vosk finish: queued final drain, empty completion and stale callback rejection passed',
);
