import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  ts = require('typescript');
const root = path.resolve(' .'.trim());
let slots = [],
  cursor = 0,
  effects = [],
  dirty = false,
  renderFn,
  result;
const React = {
  useState(v) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof v === 'function' ? v() : v;
    return [
      slots[i],
      (x) => {
        const n = typeof x === 'function' ? x(slots[i]) : x;
        if (!Object.is(n, slots[i])) {
          slots[i] = n;
          dirty = true;
        }
      },
    ];
  },
  useRef(v) {
    const i = cursor++;
    return slots[i] ?? (slots[i] = { current: v });
  },
  useEffect(fn, deps) {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) {
      slots[i] = { deps, cleanup: old?.cleanup };
      effects.push(() => {
        old?.cleanup?.();
        slots[i].cleanup = fn();
      });
    }
  },
  useMemo(fn, deps) {
    const ref = React.useRef();
    if (!ref.current || deps.some((v, j) => v !== ref.current.deps[j]))
      ref.current = { deps, value: fn() };
    return ref.current.value;
  },
};
const storage = new Map();
let speechCallbacks,
  aborts = 0,
  completes = 0,
  rests = 0,
  uiMic;
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpile(fs.readFileSync(path.join(root, file), 'utf8'), {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    }),
    {
      module,
      exports: module.exports,
      console,
      Date,
      Set,
      Math,
      localStorage: {
        getItem: (k) => storage.get(k),
        setItem: (k, v) => storage.set(k, v),
      },
      document: {
        hidden: false,
        addEventListener() {},
        removeEventListener() {},
      },
      require(p) {
        if (p === 'react') return React;
        if (p === 'react/jsx-runtime')
          return {
            jsx: (type, props) => ({ type, props }),
            jsxs: (type, props) => ({ type, props }),
          };
        if (p.endsWith('.css')) return {};
        if (p === 'lucide-react') return {};
        if (p === '@/components/ui/progress') return { Progress: () => null };
        if (p.includes('completion-celebration'))
          return { default: () => null };
        if (p === './use-text-microphone')
          return {
            useTextMicrophone: (...args) => {
              uiMic = args;
              return { progress: 0, level: 0, status: 'listening' };
            },
          };
        if (p === '@/lib/local-speech')
          return {
            startLocalSpeech: (options) => {
              speechCallbacks = options;
              return {
                abort() {
                  aborts++;
                },
                setEnabled() {},
              };
            },
          };
        const base = p.startsWith('@/')
          ? p.slice(2)
          : path.posix.join(path.posix.dirname(file), p);
        return load(
          base +
            (fs.existsSync(path.join(root, base + '.tsx')) ? '.tsx' : '.ts'),
        );
      },
    },
  );
  return module.exports;
}
function flush() {
  for (let i = 0; i < 25; i++) {
    dirty = false;
    cursor = 0;
    result = renderFn();
    const list = effects;
    effects = [];
    list.forEach((fn) => fn());
    if (!dirty) return result;
  }
  throw Error('render loop');
}
function mount(fn) {
  slots = [];
  effects = [];
  renderFn = fn;
  return flush();
}
const hook = load('features/library/use-text-microphone.ts').useTextMicrophone;
let target = 'Кот спит.',
  key = 'a',
  enabled = true;
mount(() =>
  hook(
    target,
    key,
    enabled,
    '',
    () => completes++,
    () => rests++,
  ),
);
speechCallbacks.onPartial('кот спит');
flush();
assert.equal(completes, 0);
assert.equal(result.progress, 0);
assert.equal(result.previewProgress, 7);
speechCallbacks.onActivity('pause');
flush();
assert.equal(completes, 0);
const final = (text, conf = 0.9) => ({ text, result: [{ word: text, conf }] });
speechCallbacks.onResult(final('кот'));
flush();
assert.equal(result.progress, 3);
const stale = speechCallbacks;
enabled = false;
flush();
assert.equal(aborts, 1);
stale.onResult(final('спит'));
flush();
assert.equal(completes, 0);
enabled = true;
flush();
speechCallbacks.onResult(final('спит'));
flush();
assert.equal(completes, 1);
speechCallbacks.onResult(final('кот спит'));
flush();
assert.equal(completes, 1);
key = 'b';
target = 'Мама мыла раму.';
flush();
assert.equal(result.progress, 0);
speechCallbacks.onResult(final('я не хочу'));
flush();
assert.equal(rests, 1);
slots.forEach((s) => s?.cleanup?.());
// Preserve the correctly recognized prefix of a phrase with a wrong ending.
key = 'prefix';
target = 'Аня посадила семечко в горшок.';
enabled = true;
flush();
speechCallbacks.onResult({
  text: 'аня посадила семечко на стол',
  result: [
    { word: 'аня', conf: 0.95 },
    { word: 'посадила', conf: 0.95 },
    { word: 'семечко', conf: 0.95 },
    { word: 'на', conf: 0.95 },
    { word: 'стол', conf: 0.95 },
  ],
});
flush();
assert.equal(result.progress, 18);
assert.equal(result.needsHelp, true);
speechCallbacks.onResult({
  text: 'в горшок',
  result: [
    { word: 'в', conf: 0.95 },
    { word: 'горшок', conf: 0.95 },
  ],
});
flush();
assert.equal(result.progress, 25);
console.log(
  'PASS recognized prefix survives incorrect ending; continuation completes without rereading',
);
const Exercise = load('features/library/TextExercise.tsx').default;
const item = {
  id: 'test',
  title: 'Кот',
  lines: ['Кот спит.', 'Мама мыла раму.'],
  question: 'Что делает кот?',
  options: ['Спит', 'Ест'],
  answer: 'Спит',
  hint: 'Посмотри на строку.',
};
const awards = [];
const model = {
  stop() {},
  update() {},
  awardReadingText(...args) {
    awards.push(args);
  },
  settings: { motion: false, sound: false, micConsent: true, micDevice: '' },
  setPaused() {},
};
function nodes(n) {
  if (!n) return [];
  if (Array.isArray(n)) return n.flatMap((x) => nodes(x));
  if (typeof n !== 'object') return [];
  return [n, ...nodes(n.props?.children ?? null)];
}
function text(n) {
  if (n == null) return '';
  if (Array.isArray(n)) return n.map(text).join('');
  if (typeof n !== 'object') return String(n);
  return text(n.props?.children);
}
function click(label) {
  const b = nodes(result).find(
    (n) => n.type === 'button' && text(n).trim() === label,
  );
  assert(b, 'button ' + label);
  b.props.onClick();
  flush();
}
mount(() => Exercise({ item, model, onBack() {} }));
assert(!text(result).includes(item.question));
let checkbox = nodes(result).find(
  (n) => n.type === 'input' && n.props.type === 'checkbox',
);
checkbox.props.onChange({ target: { checked: true } });
flush();
click('Начать чтение с микрофоном');
assert(uiMic[2]);
uiMic[4]();
flush();
click('Следующая строка →');
assert(uiMic[2]);
assert(!text(result).includes(item.question));
uiMic[4]();
flush();
click('Ответить на вопрос →');
assert(text(result).includes(item.question));
assert(!uiMic[2]);
click('Спит');
assert.equal(awards.length, 1);
click('Отвечаю');
assert(text(result).includes(item.question));
click('Спит');
assert.equal(awards.length, 2);
click('Пишу');
function write(value) {
  const area = nodes(result).find((n) => n.type === 'textarea');
  area.props.onChange({ target: { value } });
  flush();
  click('Проверить · Enter');
}
write('Кот спти');
assert(text(result).includes('поменялись местами'));
assert.equal(awards.length, 2);
write('Кот спит');
click('Следующая строка →');
write('Мама мыла раму');
click('Завершить →');
assert.equal(awards.length, 3);
assert.equal(awards[2][2], 'write');
click('Читаю');
checkbox = nodes(result).find((n) => n.type === 'input');
checkbox.props.onChange({ target: { checked: false } });
flush();
click('Строка прочитана верно');
click('Следующая строка →');
click('Строка прочитана верно');
click('Завершить →');
assert(!text(result).includes(item.question));
assert.equal(awards.length, 3);
assert.equal(JSON.parse(storage.get('reading-text-options-v1')).ask, false);
console.log(
  'PASS text flows: partial vs final, pause/resume, stale callbacks, refusal, all lines before question, independent questions, writing, modes, saved setting, one award',
);

const Library = load('features/library/TextLibrary.tsx').default;
const topicModel = {
  ...model,
  settings: { ...model.settings, unit: 0 },
  update() {},
};
mount(() => Library({ kind: 'sentences', model: topicModel }));
const sessionNode = nodes(result).find(
  (n) => typeof n.type === 'function' && n.type.name === 'TopicTextSession',
);
assert(sessionNode);
mount(() => sessionNode.type(sessionNode.props));
let previousText;
for (let i = 0; i < 6; i++) {
  const exercise = nodes(result).find((n) => n.props?.item && n.props?.onNext);
  assert(exercise);
  assert.notEqual(exercise.props.item.id, previousText);
  previousText = exercise.props.item.id;
  exercise.props.onNext();
  flush();
  assert.equal(topicModel.settings.unit, 0);
}
console.log(
  'PASS topic session: next text stays in topic, cycles without returning to selection or immediate repeat',
);

mount(() => Exercise({ item, model, onBack() {} }));
click('Строка 2');
click('Строка прочитана верно');
// The next action must return to unread first line, not complete the whole text.
const continueButton = nodes(result).find(
  (n) =>
    n.type === 'button' &&
    n.props.className === 'primary' &&
    !text(n).includes('микрофоном'),
);
continueButton.props.onClick();
flush();
assert(text(result).includes('Строка 1 из 2'));
const guideNode = nodes(result).find(
  (n) => n.props?.onSelect && n.props?.text === 'Кот спит.',
);
guideNode.props.onSelect(4, 'спит');
flush();
uiMic[4]();
flush();
assert(!text(result).includes('Строка прочитана!'));
assert.equal(uiMic[0], 'Кот спит.');
console.log(
  'PASS guided selection: reading last line or suffix cannot skip unread prefix',
);
