import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
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
      require: (p) =>
        load(
          path.posix.normalize(path.posix.join(path.posix.dirname(name), p)),
        ),
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
  assert(wordPool(unit).length >= 1);
  assert(
    wordPool(unit).every((word) =>
      load('topic-material').fitsTopic(word, unit),
    ),
  );
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
assert.equal(nextTopic('pictures', 0).stage, 'pictures');
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

const { wordBank, freshWordDeck } = load('../content/word-bank');
assert(wordBank.length >= 80);
assert.equal(new Set(wordBank.map((x) => x.word)).size, wordBank.length);
for (const entry of wordBank) assert.equal(entry.parts.join(''), entry.word);
const fresh = freshWordDeck(['А', 'Б', 'В', 'Г'], 4, ['Б', 'А']);
assert.deepEqual(new Set(fresh.slice(0, 2)), new Set(['В', 'Г']));
assert.equal(fresh[3], 'А');
for (const [answer, target] of [
  ['пёс', 'СОБАКА'],
  ['деревце', 'ДЕРЕВО'],
  ['котик', 'КОТ'],
])
  assert.equal(pictureAnswer(answer, target, true).kind, 'exact');
assert.equal(pictureAnswer('кожура', 'БАНАН', true).kind, 'part');
assert.equal(pictureAnswer('сыр', 'ЛУНА', true).kind, 'similar');
const { bubbleRound, bubbleChoice, pairDeck } = load('rest-games');
for (const n of [1, 2, 3]) {
  const r = bubbleRound('sequence', n);
  assert.equal(r.order.length, n * 3);
  assert.equal(r.order.join(','), Array(n).fill('4,3,2').join(','));
  const popped = [];
  for (let step = 0; step < r.order.length; step++) {
    const i = r.board.findIndex(
      (c, j) => c === r.order[step] && !popped.includes(j),
    );
    assert.equal(
      bubbleChoice(r.board, r.order, step, popped, i, 'sequence', n),
      'advance',
    );
    popped.push(i);
  }
  assert.equal(new Set(popped).size, n * 3);
  assert.equal(
    popped.length,
    r.board.length,
    'Completed sequence must leave no bubbles',
  );
}
const group = bubbleRound('colors', 2),
  indices = group.board.flatMap((c, i) => (c === group.order[0] ? [i] : []));
assert.equal(
  bubbleChoice(group.board, group.order, 0, [], indices[0], 'colors', 2),
  'more',
);
assert.equal(
  bubbleChoice(
    group.board,
    group.order,
    0,
    [indices[0]],
    indices[1],
    'colors',
    2,
  ),
  'advance',
);
assert.equal(
  bubbleChoice(
    group.board,
    group.order,
    0,
    [indices[0]],
    indices[0],
    'colors',
    2,
  ),
  'wait',
);
for (const n of [2, 3, 4, 6, 8]) {
  const deck = pairDeck(n);
  assert.equal(deck.length, n * 2);
  for (const c of new Set(deck))
    assert.equal(deck.filter((x) => x === c).length, 2);
}
console.log(
  'PASS new content and rest games: complete word parts, synonyms, color groups/sequences and all pair difficulties',
);

// Render the shared navigation independently of browser/microphone state.
const React = require('react'),
  { renderToStaticMarkup } = require('react-dom/server');
const jsxCache = {};
function loadView(relative) {
  if (jsxCache[relative]) return jsxCache[relative];
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(root + '/' + relative, 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    }),
    {
      module,
      exports: module.exports,
      require(p) {
        if (p.endsWith('.css')) return {};
        if (!p.startsWith('.') && !p.startsWith('@/')) return require(p);
        const base = p.startsWith('@/')
          ? p.slice(2)
          : path.posix.join(path.posix.dirname(relative), p);
        return loadView(
          base + (fs.existsSync(root + '/' + base + '.tsx') ? '.tsx' : '.ts'),
        );
      },
    },
  );
  return (jsxCache[relative] = module.exports);
}
const Header = loadView('features/lesson/LessonHeader.tsx').default,
  Sidebar = loadView('features/lesson/LessonSidebar.tsx').default;
const noop = () => {},
  navModel = {
    stage: 'syllables',
    navigate: noop,
    stop: noop,
    setParent: noop,
    setRest: noop,
  };
const headerHtml = renderToStaticMarkup(
  React.createElement(Header, {
    model: navModel,
    onHome: noop,
    onCabinet: noop,
  }),
);
assert(headerHtml.includes('Мой кабинет'));
assert(headerHtml.indexOf('Мой кабинет') < headerHtml.indexOf('Для взрослого'));
assert(headerHtml.includes('Читаем по шагам — главная'));
assert(!headerHtml.includes('>Главная<'));
for (const section of ['syllables', 'sentences', 'stories', 'poems']) {
  const html = renderToStaticMarkup(
    React.createElement(Sidebar, {
      model: navModel,
      active: section,
      onSelect: noop,
      onAbout: noop,
    }),
  );
  for (const label of [
    'Буквы',
    'Слоги',
    'Слова',
    'Картинки',
    'Предложения',
    'Рассказы',
    'Стихи',
  ])
    assert(html.includes(label));
  assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
  assert(html.indexOf('Разминка') < html.indexOf('О проекте'));
}
console.log(
  'PASS shared navigation: all seven sections, one current selection, cabinet next to settings, about below rest',
);

const { visionProfiles, parseVision, bubbleSymbols } = load('vision');
assert.equal(parseVision('unknown'), 'off');
assert.equal(parseVision('__proto__'), 'off');
assert.equal(parseVision(null), 'off');
assert.equal(new Set(bubbleSymbols.map((s) => s.symbol)).size, 5);
function luminance(hex) {
  const rgb = hex
    .match(/[0-9a-f]{2}/gi)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const VisionSettings = loadView('features/lesson/VisionSettings.tsx').default,
  Slots = loadView('features/lesson/LetterSlots.tsx').default,
  Bubbles = loadView('components/color-bubbles.tsx').default;
for (const mode of ['protan', 'deutan', 'tritan', 'mono']) {
  assert.equal(parseVision(mode), mode);
  for (const ink of [visionProfiles[mode].first, visionProfiles[mode].second])
    for (const bg of ['#ffffff', '#fffefb', '#f7f8f2'])
      assert(contrast(ink, bg) >= 4.5, `${mode} ${ink} contrast on ${bg}`);
  const preview = renderToStaticMarkup(
    React.createElement(VisionSettings, { value: mode, onChange: noop }),
  );
  assert(preview.includes('двойная линия'));
  const slots = renderToStaticMarkup(
    React.createElement(Slots, {
      target: 'СЫР',
      value: '',
      onChange: noop,
      onSubmit: noop,
      attempts: 1,
      disabled: false,
      vision: mode,
    }),
  );
  assert(slots.includes('Двойная линия'));
  assert(!slots.includes('Красные окошки'));
  const bubbles = renderToStaticMarkup(
    React.createElement(Bubbles, {
      motion: false,
      sound: false,
      autoSpeech: false,
      onSpeak: noop,
      onTone: noop,
      vision: mode,
    }),
  );
  assert(bubbles.includes('со звездой'));
  assert(bubbles.includes('плюс, ромб, квадрат'));
  assert(!bubbles.includes('По очереди: красный'));
}
console.log(
  'PASS vision: validated profiles, 4.5:1 palette contrast, distinct symbols, non-color slot and bubble instructions',
);

const { pictureRetry } = load('picture-retry');
for (const slots of [true, false]) {
  const first = pictureRetry(1, 'ДЕРЕВО', slots);
  assert(!first.hint);
  assert(!first.scene);
  assert(!first.message.includes('дерево'));
  assert(!first.message.includes('ДЕРЕВО'));
}
assert(pictureRetry(2, 'ДЕРЕВО', false).hint);
assert(!pictureRetry(2, 'СЫР', true).hint);
assert.match(pictureRetry(2, 'СЫР', true, true).message, /линии/);
assert(!pictureRetry(3, 'СЫР', true).hint);
assert(pictureRetry(4, 'СЫР', true).hint);
console.log(
  'PASS picture retries: unrelated first answer stays unrevealed; spelling help remains immediate',
);

const { bubbleGrid } = load('rest-games');
for (const mode of ['colors', 'sequence'])
  for (const density of [1, 2, 3]) {
    const count = bubbleRound(mode, density).board.length;
    const grid = bubbleGrid(count);
    assert(grid.columns * grid.rows >= count);
    assert(grid.rows <= 4);
    assert(grid.columns <= 4);
  }
assert(bubbleGrid(15).rows > bubbleGrid(5).rows);
console.log('PASS bubble layout: every difficulty fits within a bounded grid');

const { pairGrid } = load('rest-games');
for (const amount of [2, 3, 4, 6, 8]) {
  const grid = pairGrid(amount);
  assert.equal(grid.rows * grid.columns, amount * 2);
  assert(grid.rows <= 4 && grid.columns <= 4);
}

const { advanceTextReading, readingLetters, checkTextWriting } =
  load('text-practice');
let textProgress = advanceTextReading('Кот спит.', 0, 'кот', 0.9);
assert.equal(textProgress, 3);
assert.equal(
  advanceTextReading('Кот спит.', textProgress, 'я хочу играть', 0.9),
  textProgress,
);
assert.equal(
  advanceTextReading('Кот спит.', textProgress, 'спит', 0.3),
  textProgress,
);
assert.equal(
  advanceTextReading('Кот спит.', textProgress, 'спит', 0.9),
  readingLetters('Кот спит.').length,
);
assert.equal(advanceTextReading('Кот спит.', 0, 'спит кот', 0.9), 0);
assert.equal(
  advanceTextReading('Мама мыла раму.', 0, 'мааама мыыыла раааму', 0.9),
  readingLetters('Мама мыла раму.').length,
);
assert(checkTextWriting('КОТ спит', 'Кот спит.', 1).correct);
assert(!checkTextWriting('кот123 спит', 'Кот спит.', 1).correct);
assert(!checkTextWriting('спит кот', 'Кот спит.', 1).correct);
assert.equal(checkTextWriting('Кот спти', 'Кот спит.', 1).hint.kind, 'swap');
assert.equal(checkTextWriting('Кот спрт', 'Кот спит.', 1).hint.kind, 'replace');
assert(!checkTextWriting('Лиса бежит', 'Кот спит.', 1).hint);
console.log(
  'PASS text practice: final sequential reading, low confidence and unrelated speech, text writing and precise typo help',
);

const { fitsTopic } = load('topic-material');
const { textsForTopic } = load('topic-texts');
assert.deepEqual(Array.from(wordPool(0)), ['МАМА']);
assert(!wordPool(0).includes('ЧЕРЕПАХА'));
for (let unit = 0; unit < 13; unit++) {
  for (const kind of ['sentences', 'stories', 'poems']) {
    const texts = textsForTopic(kind, unit);
    assert(texts.length > 0);
    for (const t of texts)
      assert([...t.lines, ...t.options].every((s) => fitsTopic(s, unit)));
  }
}
const LetterDisplay = loadView('features/lesson/LetterDisplay.tsx').default;
for (const [letterCase, expected] of [
  ['upper', 'Б'],
  ['lower', 'б'],
  ['both', 'Б б'],
]) {
  const html = renderToStaticMarkup(
    React.createElement(LetterDisplay, {
      letter: 'Б',
      settings: { letterMode: 'alphabet', letterCase, color: false },
    }),
  );
  assert(html.includes(expected));
  assert(html.includes('[бэ]'));
}
const soundHtml = renderToStaticMarkup(
  React.createElement(LetterDisplay, {
    letter: 'Б',
    settings: { letterMode: 'sounds', letterCase: 'both', color: false },
  }),
);
assert(soundHtml.includes('[б]'));
assert(!soundHtml.includes('[бэ]'));
console.log(
  'PASS shared topics and letter presentation: all target alphabets, no advanced early words, case and sound/name distinction',
);

const { guideParts, firstUnreadSource } = load('reading-guide');
for (const value of [
  'Мама мыла раму.',
  'Тим лёг на коврик.',
  'Соня села рядом. Кот уснул.',
]) {
  for (const unit of ['line', 'word', 'syllable'])
    assert.equal(
      guideParts(value, unit)
        .map((p) => p.text)
        .join(''),
      value,
    );
}
assert.equal(guideParts('МУХА', 'syllable').filter((p) => p.letters).length, 2);
assert.equal(firstUnreadSource('Кот спит.', new Set([3, 4, 5, 6])), 0);
assert.equal(
  firstUnreadSource('Кот спит.', new Set([0, 1, 2, 3, 4, 5, 6])),
  null,
);
assert.equal(
  advanceTextReading('Мама, ау!', 0, 'мама ау', 0.9),
  readingLetters('Мама, ау!').length,
);
const Guide = loadView('features/lesson/ReadingGuide.tsx').default;
const quietGuide = renderToStaticMarkup(
  React.createElement(Guide, {
    text: 'МУХА',
    focus: 'syllable',
    progress: 2,
    highlight: false,
    onSelect: noop,
  }),
);
assert(!quietGuide.includes('guide-current'));
assert(quietGuide.includes('Читать: ХА'));
console.log(
  'PASS reading guide: word/syllable reconstruction, uncovered prefix, adjacent vowels and optional highlighting',
);

const { selectNarratorVoice } = load('narrator-voice');
const narrators = [{lang: 'en-US', name: 'Pavel'}, {lang: 'ru-RU', name: 'Irina'}, {lang: 'ru-RU', name: 'Pavel'}];
assert.equal(selectNarratorVoice(narrators, 'male'), narrators[2]);
assert.equal(selectNarratorVoice(narrators, 'female'), narrators[1]);
assert.equal(selectNarratorVoice([narrators[1]], 'male'), narrators[1]);
assert.equal(selectNarratorVoice([], 'female'), undefined);
