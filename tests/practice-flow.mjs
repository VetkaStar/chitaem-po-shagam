import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url),
  ts = require('typescript'),
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Small hook host: run the real lesson coordinator, not a duplicate of its rules.
let slots = [],
  cursor = 0,
  pending = [],
  dirty = false,
  model,
  now = 0;
const events = new Map();
const intervals = new Map(),
  storage = new Map(),
  cleanups = [];
const React = {
  useState(initial) {
    const i = cursor++;
    if (!(i in slots))
      slots[i] = typeof initial === 'function' ? initial() : initial;
    return [
      slots[i],
      (v) => {
        const next = typeof v === 'function' ? v(slots[i]) : v;
        if (!Object.is(next, slots[i])) {
          slots[i] = next;
          dirty = true;
        }
      },
    ];
  },
  useRef(initial) {
    const i = cursor++;
    return slots[i] ?? (slots[i] = { current: initial });
  },
  useEffect(fn, deps) {
    const i = cursor++,
      old = slots[i];
    if (!old || !deps || deps.some((x, j) => !Object.is(x, old.deps?.[j]))) {
      slots[i] = { deps, cleanup: old?.cleanup };
      pending.push(() => {
        old?.cleanup?.();
        slots[i].cleanup = fn();
      });
    }
  },
};
const FakeDate = class extends Date {
  static now() {
    return now;
  }
};
let speechOptions;
const globals = {
  console,
  Date: FakeDate,
  Math,
  Set,
  Map,
  AbortController,
  performance: { now: () => now },
  setTimeout,
  clearTimeout,
  setInterval: (fn) => {
    const id = Symbol();
    intervals.set(id, fn);
    return id;
  },
  clearInterval: (id) => intervals.delete(id),
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
  },
  document: {
    hidden: false,
    addEventListener(name, fn) {
      events.set(name, fn);
    },
    removeEventListener(name) {
      events.delete(name);
    },
  },
  navigator: {
    mediaDevices: {
      getUserMedia() {},
      enumerateDevices: () => Promise.resolve([]),
    },
  },
  window: {
    AudioContext: function () {},
    WebAssembly: {},
    speechSynthesis: { cancel() {} },
  },
};
const cache = {};
function load(file) {
  file = path.resolve(file);
  if (cache[file]) return cache[file];
  const module = { exports: {} };
  cache[file] = module.exports;
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(file, 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    }),
    {
      ...globals,
      module,
      exports: module.exports,
      require(p) {
        if (p === 'react') return React;
        if (p.endsWith('local-speech'))
          return {
            startLocalSpeech: (o) => {
              speechOptions = o;
              return { abort() {}, setEnabled() {} };
            },
          };
        return load(
          path.resolve(
            p.startsWith('@/') ? root : path.dirname(file),
            p.replace(/^@\//, ''),
          ) + '.ts',
        );
      },
    },
    { filename: file },
  );
  return module.exports;
}
const useLesson = load(
  path.join(root, 'features/lesson/use-lesson.ts'),
).useLesson;
function render() {
  let safety = 0;
  do {
    dirty = false;
    cursor = 0;
    model = useLesson();
    const effects = pending;
    pending = [];
    effects.forEach((f) => f());
    assert(++safety < 40, 'render loop');
  } while (dirty);
  return model;
}
function act(fn) {
  fn(model);
  return render();
}
render();
act((m) => {
  m.setLessonActive(true);
  m.navigate('pictures', 'type');
});
// Free synonyms really complete a card and award exactly once.
const { synonyms } = load(path.join(root, 'lib/session.ts'));
assert(synonyms[model.target]?.length);
act((m) => m.setAnswer(synonyms[m.target][0]));
const before = model.stars;
act((m) => m.submit());
assert.equal(model.feedback.kind, 'success');
assert.equal(model.stars, before + 1);
act((m) => m.submit());
assert.equal(model.stars, before + 1);
act((m) => m.update('pictureMode', 'letters'));
act((m) => m.next());
for (let n = 1; n <= 3; n++) {
  act((m) => m.setAnswer('ЫЫЫЫ'));
  act((m) => m.submit());
  assert.equal(model.mistakes, n);
  assert.notEqual(model.feedback.kind, 'success');
  assert.equal(model.hint, n >= 3);
}
act((m) => m.setAnswer(m.target));
act((m) => m.submit());
assert.equal(model.feedback.kind, 'success');
// New word lessons prefer unseen words, persisted even when skipped.
const seen = new Set();
for (let i = 0; i < 10; i++) {
  act((m) => m.navigate('words', 'read'));
  assert(!seen.has(model.target));
  seen.add(model.target);
  act((m) => m.next(true));
}
assert(JSON.parse(storage.get('reading-steps-v3')).recentWords.length >= 10);
act((m) => m.update('wordMode', 'parts'));
const { wordParts } = load(path.join(root, 'content/word-bank.ts'));
for (let i = 0; wordParts(model.target).length < 2 && i < 30; i++)
  act((m) => m.navigate('words', 'read'));
assert(model.showParts);
const wordStars = model.stars;
act((m) => m.success('adult'));
assert.equal(model.stars, wordStars);
assert(model.wholeAgain);
assert(!model.showParts);
assert.match(model.feedback.text, /целиком/);
act((m) => m.success('adult'));
assert.equal(model.stars, wordStars + 1);
// Count rests, repeated quick dismissals and snooze.
act((m) => {
  m.update('length', 8);
  m.update('breakEvery', 3);
});
for (let i = 0; i < 3; i++) act((m) => m.next(true));
assert(model.rest);
act((m) => {
  m.schedule.returned(true);
  m.setRest(false);
});
act((m) => m.schedule.returned(true));
assert.equal(model.schedule.skips, 2);
act((m) => m.schedule.snooze(5));
assert(!model.schedule.shouldRest(3, 8));
now += 300001;
assert(model.schedule.shouldRest(3, 8));
// Time includes active lesson only, not menus or rest.
act((m) => {
  m.update('breakMinutes', 3);
  m.update('breakEvery', 0);
  m.setLessonActive(true);
});
function seconds(n, engaged = false) {
  for (let i = 0; i < n; i++) {
    now += 1000;
    if (engaged && i % 20 === 0) model.schedule.touch();
    [...intervals.values()].forEach((f) => f());
    render();
  }
}
seconds(600);
assert(!model.schedule.due, 'Idle open tab must not start rest timer');
seconds(90, true);
assert(!model.schedule.due);
act((m) => m.setLessonActive(false));
seconds(240);
assert(!model.schedule.due);
act((m) => m.setLessonActive(true));
seconds(90, true);
assert(model.schedule.due);
assert(model.schedule.shouldRest(1, 8));
assert(!model.schedule.shouldRest(8, 8));

// Hiding and reopening the tab must not open the rest dialog.
act((m) => {
  m.setRest(false);
  m.setPaused(false);
});
globals.document.hidden = true;
act(() => events.get('visibilitychange')());
assert(!model.paused);
assert(!model.rest);
globals.document.hidden = false;
act(() => events.get('visibilitychange')());
assert(!model.paused);
assert(!model.rest);

// The alphabet accepts a letter name; sound mode explains rather than accepting it.
act((m) => {
  m.update('breakMinutes', 0);
  m.update('breakEvery', 0);
  m.update('unit', 0);
  m.update('letterMode', 'alphabet');
  m.navigate('letters', 'read');
});
for (let i = 0; model.target !== 'М' && i < 4; i++) act((m) => m.next(true));
assert.equal(model.target, 'М');
act((m) => {
  m.update('micConsent', true);
  m.setLessonMic(true);
});
act(() => speechOptions.onReady());
const letterStars = model.stars;
act(() => speechOptions.onResult({ text: 'эм', result: [{ conf: 1 }] }));
assert.equal(model.stars, letterStars + 1);
act((m) => {
  m.update('letterMode', 'sounds');
  m.navigate('letters', 'read');
});
for (let i = 0; model.target !== 'М' && i < 4; i++) act((m) => m.next(true));
assert.equal(model.target, 'М');
act((m) => m.setLessonMic(true));
act(() => speechOptions.onReady());
const soundStars = model.stars;
act(() => speechOptions.onResult({ text: 'эм', result: [{ conf: 1 }] }));
assert.equal(model.stars, soundStars);
assert.match(model.feedback.text, /назвал букву/);
act(() => speechOptions.onResult({ text: 'м', result: [{ conf: 1 }] }));
assert.equal(model.stars, soundStars + 1);
const visionStars = model.stars;
for (const mode of ['protan', 'deutan', 'tritan', 'mono', 'off']) {
  act((m) => m.update('colorVision', mode));
  assert.equal(model.settings.colorVision, mode);
  assert.equal(
    JSON.parse(storage.get('reading-steps-v3')).settings.colorVision,
    mode,
  );
  assert.equal(model.stars, visionStars);
}
for (const slot of slots) slot?.cleanup?.();
console.log(
  'PASS practice flow: synonyms, progressive letter help, fresh words, parts→whole, stars, timed rests, pause and snooze',
);
