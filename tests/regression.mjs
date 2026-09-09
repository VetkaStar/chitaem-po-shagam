import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url).pathname.replace(
  /^\/(?:([A-Z]:))/,
  '$1',
);
const ts = require(root + '/node_modules/typescript');
const cache = {};
function load(name, globals = {}) {
  if (cache[name]) return cache[name];
  const source = fs.readFileSync(root + '/lib/' + name + '.ts', 'utf8'),
    module = { exports: {} };
  vm.runInNewContext(
    ts.transpile(source, {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
    {
      exports: module.exports,
      module,
      require: (p) => load(p.replace('./', '')),
      console,
      setTimeout,
      clearTimeout,
      Array,
      Math,
      Set,
      Map,
      ...globals,
    },
  );
  return (cache[name] = module.exports);
}
const { makeDeck, wordPool, pictureAnswer } = load('session');
for (let unit = 0; unit < 6; unit++) {
  assert(wordPool(unit).length >= 8);
  let old = [];
  for (let run = 0; run < 40; run++) {
    const deck = makeDeck(['АМ', 'УМ', 'МА', 'МУ'], 24, old);
    assert.equal(deck.length, 24);
    assert.equal(new Set(deck.slice(0, 4)).size, 4);
    for (let i = 1; i < deck.length; i++) assert.notEqual(deck[i], deck[i - 1]);
    if (old.length) assert.notEqual(deck[0], old[0]);
    old = deck;
  }
}
for (const [v, t, kind] of [
  ['кожура', 'БАНАН', 'part'],
  ['колёса', 'МАШИНА', 'part'],
  ['ветки', 'ДЕРЕВО', 'part'],
  ['крыша', 'ДОМ', 'part'],
  ['кожура', 'КОТ', 'other'],
  ['котик', 'КОТ', 'related'],
  ['кошка', 'КОТ', 'related'],
  ['избушка', 'ДОМ', 'related'],
  ['сыр', 'ЛУНА', 'similar'],
  ['месяц', 'ЛУНА', 'related'],
  ['пёсик', 'СОБАКА', 'related'],
  ['кот', 'КОТ', 'exact'],
  ['стол', 'КОТ', 'other'],
])
  assert.equal(pictureAnswer(v, t).kind, kind);
const { classifyUtterance: c } = load('feedback');
const candidates = ['АМ', 'УМ', 'МА', 'МУ'];
assert.equal(c('ум', 0.95, 'УМ', candidates).kind, 'correct');
assert.equal(c('му', 0.95, 'УМ', candidates).kind, 'wrong');
assert.equal(c('му', 0.6, 'УМ', candidates).kind, 'unclear');
assert.equal(c('я люблю котика', 0.99, 'УМ', candidates).kind, 'ignore');
assert.equal(c('нет я не хочу', 0.95, 'УМ', candidates).kind, 'rest');
assert.equal(c('мама сказала ум', 0.95, 'УМ', candidates).kind, 'ignore');
assert.equal(c('[unk]', 0.99, 'УМ', candidates).kind, 'ignore');
let recs = [],
  streams = 0,
  stopped = 0,
  closed = 0,
  results = [];
class Rec {
  constructor() {
    this.handlers = {};
    recs.push(this);
  }
  setWords() {}
  on(e, cb) {
    this.handlers[e] = cb;
  }
  remove() {
    this.removed = true;
  }
  acceptWaveform() {}
  emit(text) {
    this.handlers.result({
      result: { text, result: [{ conf: 0.95, word: text }] },
    });
  }
}
class Model {
  KaldiRecognizer = Rec;
  on(e, cb) {
    if (e === 'load') queueMicrotask(() => cb({ result: true }));
  }
  terminate() {}
}
const connection = () => ({ connect() {}, disconnect() {} });
class Context {
  state = 'running';
  sampleRate = 48000;
  destination = {};
  async resume() {}
  async close() {
    this.state = 'closed';
    closed++;
  }
  createMediaStreamSource() {
    return connection();
  }
  createAnalyser() {
    return {
      fftSize: 512,
      frequencyBinCount: 256,
      getFloatTimeDomainData(a) {
        a.fill(0.1);
      },
      getByteFrequencyData(a) {
        a.fill(64);
      },
      ...connection(),
    };
  }
  createScriptProcessor() {
    return { ...connection(), onaudioprocess: null };
  }
}
const { startLocalSpeech } = load('local-speech', {
  AudioContext: Context,
  window: { Vosk: { Model } },
  navigator: {
    mediaDevices: {
      getUserMedia: async () => {
        streams++;
        return {
          getTracks: () => [
            {
              stop() {
                stopped++;
              },
            },
          ],
        };
      },
    },
  },
  fetch: async (url) => {
    assert.equal(
      url,
      'https://example.github.io/reading-app/speech/model.json',
    );
    return { ok: true, json: async () => ({ bytes: 0, parts: [] }) };
  },
  document: { baseURI: 'https://example.github.io/reading-app/' },
  URL: class extends URL {
    static createObjectURL() {
      return '';
    }
    static revokeObjectURL() {}
  },
  Blob,
  performance: { now: () => 100 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  queueMicrotask,
  Float32Array,
  Uint8Array,
});
let ready;
const wait = new Promise((r) => (ready = r));
const session = startLocalSpeech({
  vocabulary: candidates,
  onLevel() {},
  onSpectrum(v) {
    assert.equal(v.length, 12);
  },
  onStatus() {},
  onReady: ready,
  onPartial() {},
  onResult: (r) => results.push(r.text),
  onError: (e) => {
    throw Error(e);
  },
});
await wait;
recs.at(-1).emit('ам');
recs.at(-1).emit('ум');
assert.equal(results.join(','), 'ам,ум');
assert.equal(streams, 1);
assert.equal(stopped, 0);
const old = recs.at(-1);
session.setEnabled(false);
old.emit('ма');
assert.equal(results.length, 2);
session.setEnabled(true);
old.emit('ма');
assert.equal(results.length, 2);
recs.at(-1).emit('му');
assert.equal(results.length, 3);
assert.equal(streams, 1);
session.abort();
recs.at(-1).emit('ма');
assert.equal(results.length, 3);
assert.equal(stopped, 1);
assert.equal(closed, 1);
console.log(
  'PASS: 240 shuffled lessons, word variety, picture aliases and ambiguity, speech filtering; continuous stream, stale results and cleanup.',
);

const { SlowReadingAttempt, matchFragment } = load('slow-reading');
assert.equal(matchFragment('мууууу хааа', 'МУХА'), 4);
const a = new SlowReadingAttempt();
assert.equal(a.accept('мууу', 0.95, 'МУХА', 1000).kind, 'pending');
assert.equal(a.progress, 2);
assert.equal(a.accept('хааа', 0.95, 'МУХА', 12000).kind, 'complete');
assert.equal(a.accept('ха', 0.95, 'МУХА', 14000).kind, 'unrelated');
a.accept('му', 0.95, 'МУХА', 15000);
a.accept('привет', 0.95, 'МУХА', 16000);
assert.equal(a.accept('ха', 0.95, 'МУХА', 17000).kind, 'unrelated');
a.accept('му', 0.95, 'МУХА', 18000);
assert.equal(a.accept('ха', 0.95, 'МУХА', 40000).kind, 'unrelated');
assert.equal(a.accept('муха', 0.3, 'МУХА').kind, 'unclear');
assert.equal(matchFragment('я хочу муха', 'МУХА'), null);
assert.equal(matchFragment('ха му', 'МУХА'), null);
console.log(
  'PASS slow reading: stretched vowels, 11-second pause, order, reset, unrelated speech and confidence.',
);
const { nextTopic, topicNames } = load('topics');
assert.equal(topicNames.length, 13);
assert.equal(nextTopic('syllables', 0).unit, 1);
assert.equal(nextTopic('syllables', 12).stage, 'words');
assert.equal(nextTopic('words', 12).stage, 'pictures');
assert.equal(nextTopic('pictures', 0).stage, 'letters');
console.log('PASS: next topics and section boundaries.');

const { breakDue } = load('breaks');
assert.equal(breakDue(3, 5, 8), false);
assert.equal(breakDue(5, 5, 8), true);
assert.equal(breakDue(5, 5, 5), false);
assert.equal(breakDue(3, 3, 8), true);
assert.equal(breakDue(6, 3, 8), true);
assert.equal(breakDue(5, 0, 8), false);
console.log('Break frequency and lesson-end priority passed');

const curriculum = load('learning').levels;
assert.equal(curriculum.length, 13);
for (const level of curriculum.slice(0, -1)) {
  assert(level.syllables.length > 0);
  for (const text of [...level.syllables, ...level.words])
    assert(
      Array.from(text).every((l) => level.letters.includes(l)),
      'Unknown letter in ' + text,
    );
}
const { availableBridges } = load('../content/word-bridges');
for (const level of curriculum)
  for (const b of availableBridges(level.letters))
    assert.equal(b.parts.join(''), b.word);
assert.equal(availableBridges(curriculum[0].letters)[0].word, 'МАМА');
const { parseProfile } = load('../features/portal/profile');
assert.equal(parseProfile('{bad'), null);
assert.equal(
  parseProfile(JSON.stringify({ name: '', age: '6', start: 'words' })),
  null,
);
assert.equal(
  parseProfile(JSON.stringify({ name: 'Тест', age: '6', start: 'words' })).name,
  'Тест',
);
const texts = load('../content/reading-library').readingTexts;
assert.equal(new Set(texts.map((t) => t.id)).size, texts.length);
for (const t of texts) {
  assert(t.lines.length);
  assert.equal(t.options.filter((o) => o === t.answer).length, 1);
}
console.log(
  'PASS: curriculum, word bridges, profile validation and comprehension content',
);
