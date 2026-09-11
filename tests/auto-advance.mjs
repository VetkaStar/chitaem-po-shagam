import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let slots = [],
  cursor = 0,
  effects = [],
  dirty = false,
  tree,
  props,
  calls = 0;
const timers = new Set();
const listeners = {};
const doc = {
  hidden: false,
  hasFocus: () => true,
  addEventListener: (n, f) => (listeners[n] = f),
  removeEventListener: (n) => delete listeners[n],
};
const win = {
  addEventListener: (n, f) => (listeners[n] = f),
  removeEventListener: (n) => delete listeners[n],
};
const react = {
  useRef: (x) => {
    const i = cursor++;
    return slots[i] ?? (slots[i] = { current: x });
  },
  useState: (x) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = x;
    return [
      slots[i],
      (v) => {
        if (slots[i] !== v) {
          slots[i] = v;
          dirty = true;
        }
      },
    ];
  },
  useEffect: (f, deps) => {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((v, j) => v !== old.deps[j])) {
      slots[i] = { deps };
      effects.push(() => {
        old?.cleanup?.();
        slots[i].cleanup = f();
      });
    }
  },
};
const mod = { exports: {} };
vm.runInNewContext(
  ts.transpile(fs.readFileSync('components/auto-advance.tsx', 'utf8'), {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  }),
  {
    module: mod,
    exports: mod.exports,
    document: doc,
    window: win,
    setInterval: (f) => {
      timers.add(f);
      return f;
    },
    clearInterval: (f) => timers.delete(f),
    require: (p) =>
      p === 'react'
        ? react
        : p === 'react/jsx-runtime'
          ? {
              jsx: (type, props) => ({ type, props }),
              jsxs: (type, props) => ({ type, props }),
            }
          : {},
  },
);
function render() {
  do {
    dirty = false;
    cursor = 0;
    tree = mod.exports.default(props);
    const e = effects;
    effects = [];
    e.forEach((f) => f());
  } while (dirty);
}
function tick() {
  [...timers].forEach((f) => f());
  render();
}
function mount(extra = {}) {
  for (const s of slots) s?.cleanup?.();
  slots = [];
  props = {
    enabled: true,
    blocked: false,
    seconds: 3,
    onNext: () => calls++,
    ...extra,
  };
  render();
}
mount();
tick();
tick();
assert.equal(calls, 0);
tick();
assert.equal(calls, 1);
tick();
assert.equal(calls, 1);
mount();
tick();
props.blocked = true;
render();
tick();
assert.equal(calls, 1);
props.blocked = false;
render();
tick();
tick();
assert.equal(calls, 1);
tick();
assert.equal(calls, 2);
mount();
doc.hidden = true;
listeners.visibilitychange();
tick();
tick();
tick();
assert.equal(calls, 2);
doc.hidden = false;
listeners.visibilitychange();
tick();
tick();
tick();
assert.equal(calls, 3);
mount();
function find(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'button') return n;
  for (const x of [n.props?.children].flat()) {
    const b = find(x);
    if (b) return b;
  }
}
find(tree).props.onClick();
render();
tick();
tick();
tick();
assert.equal(calls, 3);
mount({ enabled: false });
tick();
tick();
tick();
assert.equal(calls, 3);
console.log(
  'PASS auto advance: 3-second delay, single callback, modal pause, hidden tab, cancellation, disabled setting',
);

// Extra reading time does not expire at the normal 3-second boundary.
const beforeExtra = calls;
mount({ inline: true, seconds: 15 });
for (let i = 0; i < 14; i++) tick();
assert.equal(calls, beforeExtra);
tick();
assert.equal(calls, beforeExtra + 1);
// A deliberate stop survives focus changes and temporary modal pauses.
mount({ inline: true, seconds: 15 });
for (let i = 0; i < 3; i++) tick();
props.stopped = true;
render();
assert.equal(tree.props['aria-label'], 'Автопереход остановлен');
listeners.blur?.();
listeners.focus?.();
props.blocked = true;
render();
props.blocked = false;
render();
for (let i = 0; i < 30; i++) tick();
assert.equal(calls, beforeExtra + 1);
mount({ inline: true, seconds: 3 });
for (let i = 0; i < 3; i++) tick();
assert.equal(calls, beforeExtra + 2, 'the next task gets its own timer');
console.log('PASS extra reading time and persistent per-task timer stop');

