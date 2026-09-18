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
verifier.tasks[0].resolve();
assert.equal(combinedFinals.length,0,'wait for both final results');
fast.tasks.find(t=>t.kind==='finish').reply({result:{text:'',final:true}});
fast.tasks.find(t=>t.kind==='finish').resolve();
await new Promise(resolve=>setTimeout(resolve,0));
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

const emptyResults = [], processingStatuses = [];
let emptyReady;
const emptyPrepared = new Promise(resolve => {emptyReady=resolve;});
const emptyBase=sessions.length;
const emptyEngine=startBrowserSpeech({speechModel:'combined:gigaam-ctc-int8',
 onReady:emptyReady,onLevel(){},onStatus:s=>processingStatuses.push(s),onPartial(){},
 onResult:r=>emptyResults.push(r),onError:e=>errors.push(e)});
await emptyPrepared;
audio(0.1);for(let i=0;i<4;i++)audio(0);
const emptyVerifier=sessions.slice(emptyBase).find(s=>s.model==='gigaam-ctc-int8');
assert(processingStatuses.includes('Проверяю услышанное…'));
emptyVerifier.tasks[0].reply({result:{text:'',final:true}});
emptyVerifier.tasks[0].resolve();
const emptyFast=sessions.slice(emptyBase).find(s=>s.lane==='preview');
emptyFast.tasks.find(t=>t.kind==='finish').reply({result:{text:'',final:true}});
emptyFast.tasks.find(t=>t.kind==='finish').resolve();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(emptyResults.length,1,'empty final is delivered, not silently discarded');
assert.equal(emptyResults[0].text,'');
emptyEngine.abort();
for(const session of sessions.slice(emptyBase))for(const task of session.tasks)task.resolve();
console.log('PASS verifier processing and empty final remain observable');

const {ctcScore, belowSpeechThreshold}=load('lib/speech/ctc-score');
const scored={encodedData:[0,5,0, 0,4,0, 5,0,0, 0,0,3],encodedDims:[1,4,3],encodedLayout:'BTV',encodedLength:4};
const score=ctcScore(scored,0);
assert(Math.abs(score-1/(1+2*Math.exp(-3)))<1e-8);
assert.equal(ctcScore({...scored,encodedData:[5,5,5,5,0,0,0,0,0,0,0,0],encodedLayout:'BVT',encodedDims:[1,3,4]},0),undefined);
assert.equal(ctcScore({...scored,encodedData:[NaN,...scored.encodedData.slice(1)]},0),undefined);
assert(belowSpeechThreshold(0.6,65));
assert(!belowSpeechThreshold(0.65,65));
assert(belowSpeechThreshold(undefined,65));
assert(!belowSpeechThreshold(undefined,0));
console.log('PASS CTC posterior score, blank exclusion, malformed output and threshold boundary');

const {combineFinals}=load('lib/speech/combined-result');
const primary=(text,confidenceScore)=>({text,confidenceScore,model:'gigaam-ctc-int8'});
const fastResult=text=>({text,model:'zipformer-int8'});
assert.equal(combineFinals(primary('ша',.9),fastResult('са'),70).text,'ша');
assert.equal(combineFinals(primary('са',.4),fastResult('ша'),70).text,'ша');
assert.equal(combineFinals(primary('',undefined),fastResult('кот'),70).decision,'fallback');
assert.equal(combineFinals(primary('',undefined),fastResult(''),70).decision,'empty');
assert.equal(combineFinals(primary('кот',.9),fastResult(''),70).decision,'primary');
assert.equal(combineFinals(primary('кот',undefined),fastResult('кот'),70).model,'zipformer-int8');
console.log('PASS arbitration: confident GigaAM wins disagreement; weak/empty uses final Zipformer');
// Actual session fallback, not just the pure selector.
let fallbackReady;
const fallbackPrepared=new Promise(r=>fallbackReady=r), fallbackResults=[];
const fallbackBase=sessions.length;
const fallback=startBrowserSpeech({speechModel:'combined:gigaam-ctc-int8',speechConfidenceThreshold:70,
 onReady:fallbackReady,onLevel(){},onStatus(){},onPartial(){},onResult:r=>fallbackResults.push(r),onError:e=>errors.push(e)});
await fallbackPrepared;
audio(.1);for(let i=0;i<4;i++)audio(0);
const f=sessions.slice(fallbackBase).find(s=>s.lane==='preview');
const v=sessions.slice(fallbackBase).find(s=>s.model==='gigaam-ctc-int8');
f.tasks[0].reply({result:{text:'неверная предварительная',final:false}});
v.tasks[0].reply({result:{text:'',final:true}});v.tasks[0].resolve();
assert.equal(fallbackResults.length,0);
f.tasks.find(t=>t.kind==='finish').reply({result:{text:'кот',final:true}});
f.tasks.find(t=>t.kind==='finish').resolve();
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(fallbackResults[0].text,'кот');
assert.equal(fallbackResults[0].decision,'fallback');
assert.equal(fallbackResults[0].confidenceScore,undefined);
fallback.abort();
for(const s of sessions.slice(fallbackBase))for(const t of s.tasks)t.resolve();
console.log('PASS final Zipformer fallback after empty verifier ignores temporary hypothesis');
