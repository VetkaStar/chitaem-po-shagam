import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { compileCurriculum, root, supplyText } from './curriculum-harness.mjs';

const output = compileCurriculum();
for (const file of [
  'features/trainers/syllable-parts-session.ts',
  'features/trainers/catalog.ts',
  'features/trainers/task-section.ts',
  'features/trainers/session-actions.ts',
  'lib/topic-material.ts',
  'lib/learning.ts',
]) {
  const result = ts
    .transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    })
    .outputText.replace(
      /(from\s+['"])(\.[^'"]+)(['"])/g,
      (_, prefix, specifier, quote) =>
        prefix +
        (path.extname(specifier) ? specifier : specifier + '.js') +
        quote,
    );
  const destination = path.join(output, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, result);
}
const mod = (file) => import(pathToFileURL(path.join(output, file)));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { syllablePartsItems, openSyllableParts } = await mod(
  'features/trainers/syllable-parts-session.js',
);
const { trainerItems } = await mod('features/trainers/catalog.js');
const { createTrainerRoute, nextTrainerTask } = await mod(
  'features/trainers/session-actions.js',
);
const { levels } = await mod('lib/learning.js');
const supply = await loadSupply(...supplyText());
const originalBank = JSON.stringify(supply.curriculum.items);
const legacy = { getItem: () => null };
class Store {
  state = null;
  fail = false;
  async read() {
    return structuredClone(this.state);
  }
  async commit(next, expected) {
    validateState(next, supply);
    if (this.fail) throw new Error('STORAGE_FAILURE');
    assert.equal(this.state?.storageRevision ?? null, expected);
    this.state = structuredClone({
      ...next,
      storageRevision: (expected ?? -1) + 1,
    });
    return this.read();
  }
}
async function setup() {
  const store = new Store();
  return {
    store,
    controller: await CurriculumController.open(supply, store, legacy),
  };
}
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('PASS ' + name);
  passed++;
}
await test('both modes contain only authored syllables within all thirteen topic alphabets', () => {
  for (const kind of ['compose', 'find_part']) {
    const candidates = trainerItems(supply, kind, 'syllables');
    assert.ok(candidates.length > 0, kind);
    for (let unit = 0; unit < levels.length; unit++) {
      const allowed = (text) =>
        [...text.toUpperCase()].every(
          (char) =>
            !/[А-ЯЁ]/u.test(char) || levels[unit].letters.includes(char),
        );
      const expected = candidates.filter(
        (task) =>
          allowed(task.requiredLetters ?? '') &&
          allowed(task.learnerText) &&
          task.options.every((option) => allowed(option.text)),
      );
      const actual = syllablePartsItems(supply, kind, unit);
      assert.deepEqual(
        actual.map((task) => task.id).sort(),
        expected.map((task) => task.id).sort(),
        `${kind} topic ${unit}`,
      );
      assert.ok(actual.every((task) => task.kind === kind));
    }
  }
});
await test('switching modes and reopening preserves each exact unfinished instance', async () => {
  const { controller, store } = await setup();
  const saved = [];
  for (const kind of ['compose', 'find_part']) {
    const routeId = await openSyllableParts(controller, supply, kind, 12, 3);
    const state = controller.snapshot();
    assert.ok(routeId.startsWith(`syllable-parts:${kind}:12:`));
    assert.ok(
      state.customRoutes[routeId].steps.every((step) => step.mode === 'read'),
    );
    saved.push({
      kind,
      routeId,
      instanceId: state.profile.activeInstance.instanceId,
    });
  }
  await controller.leaveSession();
  const reopened = await CurriculumController.open(supply, store, legacy);
  for (const savedRoute of saved.reverse()) {
    assert.equal(
      await openSyllableParts(reopened, supply, savedRoute.kind, 12, 8),
      savedRoute.routeId,
    );
    assert.equal(
      reopened.snapshot().profile.activeInstance.instanceId,
      savedRoute.instanceId,
    );
    assert.equal(
      reopened.snapshot().customRoutes[savedRoute.routeId].steps.length,
      3,
    );
  }
});
await test('legacy eligible syllable route resumes while a newer word route stays preserved', async () => {
  const { controller, store } = await setup();
  const syllables = syllablePartsItems(supply, 'compose', 12).slice(0, 3);
  const oldRoute = createTrainerRoute(
    'compose',
    syllables.map((task) => task.id),
    'read',
  );
  await controller.registerCustomRoute(oldRoute);
  await controller.selectCustomRoute(oldRoute.routeId);
  await nextTrainerTask(controller, 7);
  const oldInstance = controller.snapshot().profile.activeInstance.instanceId;
  const words = trainerItems(supply, 'compose', 'words').slice(0, 3);
  const wordRoute = createTrainerRoute(
    'compose',
    words.map((task) => task.id),
    'read',
  );
  await controller.registerCustomRoute(wordRoute);
  await controller.selectCustomRoute(wordRoute.routeId);
  await nextTrainerTask(controller, 7);
  const wordInstance = controller.snapshot().profile.activeInstance.instanceId;
  await controller.leaveSession();
  const reopened = await CurriculumController.open(supply, store, legacy);
  assert.equal(
    await openSyllableParts(reopened, supply, 'compose', 12, 5),
    oldRoute.routeId,
  );
  assert.equal(
    reopened.snapshot().profile.activeInstance.instanceId,
    oldInstance,
  );
  const preserved = reopened.snapshot().customRoutes[wordRoute.routeId];
  assert.equal(preserved.position, 0);
  assert.equal(preserved.suspendedInstance.instanceId, wordInstance);
  assert.deepEqual(preserved.steps, wordRoute.steps);
});
await test('topic switching cannot resume a route outside the selected alphabet', async () => {
  const { controller } = await setup();
  const high = await openSyllableParts(controller, supply, 'compose', 12, 8);
  const oldSteps = structuredClone(
    controller.snapshot().customRoutes[high].steps,
  );
  const low = await openSyllableParts(controller, supply, 'compose', 0, 3);
  assert.notEqual(low, high);
  const eligible = new Set(
    syllablePartsItems(supply, 'compose', 0).map((task) => task.id),
  );
  if (low)
    assert.ok(
      controller
        .snapshot()
        .customRoutes[low].steps.every((step) => eligible.has(step.itemId)),
    );
  assert.deepEqual(controller.snapshot().customRoutes[high].steps, oldSteps);
});
await test('eight-task route crosses visit budget and completes all eight tasks once', async () => {
  const { controller } = await setup();
  const routeId = await openSyllableParts(controller, supply, 'compose', 12, 8);
  assert.equal(controller.snapshot().customRoutes[routeId].steps.length, 8);
  const instanceIds = new Set();
  for (let position = 0; position < 8; position++) {
    const state = controller.snapshot();
    const active = state.profile.activeInstance;
    assert.ok(active);
    assert.equal(state.customRoutes[routeId].position, position);
    assert.ok(!instanceIds.has(active.instanceId));
    instanceIds.add(active.instanceId);
    await controller.answer({
      instanceId: active.instanceId,
      disposition: 'skipped',
    });
    await nextTrainerTask(controller, 7);
  }
  assert.equal(controller.snapshot().customRoutes[routeId].position, 8);
  assert.equal(controller.snapshot().profile.activeInstance, null);
  assert.notEqual(
    await openSyllableParts(controller, supply, 'compose', 12, 8),
    routeId,
  );
});
await test('failed persistence neither advances nor fabricates a receipt', async () => {
  const { controller, store } = await setup();
  await openSyllableParts(controller, supply, 'compose', 12, 3);
  const before = controller.snapshot();
  store.fail = true;
  await assert.rejects(
    controller.answer({
      instanceId: before.profile.activeInstance.instanceId,
      disposition: 'skipped',
    }),
    /STORAGE_FAILURE/,
  );
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
});
assert.equal(
  JSON.stringify(supply.curriculum.items),
  originalBank,
  'Authored bank remains unchanged',
);
console.log(`${passed} syllable parts session tests PASS`);
