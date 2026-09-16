import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { compileCurriculum, root, supplyText } from './curriculum-harness.mjs';

const output = compileCurriculum();
for (const file of [
  'features/answers/session.ts',
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
const { answerItems, openAnswer, nextAnswer } = await mod(
  'features/answers/session.js',
);
const { levels } = await mod('lib/learning.js');
const { trainerItems } = await mod('features/trainers/catalog.js');
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

await test('all 13 topics retain authored targets within their cumulative alphabet', () => {
  const counts = [1, 1, 1, 4, 7, 7, 14, 14, 23, 33, 37, 61, 89];
  for (let unit = 0; unit < 13; unit++) {
    const tasks = answerItems(supply, unit);
    assert.equal(tasks.length, counts[unit], `unit ${unit}`);
    for (const task of tasks) {
      assert.equal(task.kind, 'choice');
      for (const letter of task.learnerText.toUpperCase().match(/[А-ЯЁ]/g) ??
        []) {
        assert.ok(
          levels[unit].letters.includes(letter),
          `${unit}: ${task.id}: ${letter}`,
        );
      }
    }
  }
});
await test('first topic remains one exact authored task, including assisted options', async () => {
  const { controller } = await setup();
  const id = await openAnswer(controller, supply, 0, 7);
  const route = controller.snapshot().customRoutes[id];
  assert.equal(route.steps.length, 1);
  assert.equal(route.steps[0].itemId, 'task.63a34bfc84f8');
  assert.deepEqual(
    supply.curriculum.items[route.steps[0].itemId].options.map((x) => x.text),
    ['МА', 'МО', 'АМ'],
  );
  assert.equal(controller.visible().optionsRevealed, true);
});
await test('reload resumes exact route and instance; another topic and fresh request make new routes', async () => {
  const { controller, store } = await setup();
  const first = await openAnswer(controller, supply, 12, 5);
  const instance = controller.snapshot().profile.activeInstance.instanceId;
  await controller.leaveSession();
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.equal(await openAnswer(reloaded, supply, 12, 3), first);
  assert.equal(reloaded.snapshot().profile.activeInstance.instanceId, instance);
  assert.equal(reloaded.snapshot().customRoutes[first].steps.length, 5);
  const other = await openAnswer(reloaded, supply, 0, 3);
  assert.notEqual(other, first);
  const fresh = await openAnswer(reloaded, supply, 12, 3, true);
  assert.notEqual(fresh, first);
  assert.equal(reloaded.snapshot().customRoutes[fresh].steps.length, 3);
  assert.ok(reloaded.snapshot().customRoutes[first]);
});
await test('choice is durable, advances once and finished route is not resumed', async () => {
  const { controller, store } = await setup();
  const route = await openAnswer(controller, supply, 0, 7);
  const before = controller.snapshot();
  const active = before.profile.activeInstance;
  const response = {
    optionIds: supply.curriculum.items[active.itemId].answer.correctOptionIds,
  };
  await controller.answer({ instanceId: active.instanceId, response });
  const saved = controller.snapshot();
  assert.equal(saved.customRoutes[route].position, 1);
  assert.equal(saved.profile.receipts[active.instanceId].outcome, 'correct');
  assert.deepEqual(saved.profile.programs, before.profile.programs);
  assert.deepEqual(
    saved.profile.confirmedSkills,
    before.profile.confirmedSkills,
  );
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(
    reloaded.snapshot().profile.attempts,
    saved.profile.attempts,
  );
  await nextAnswer(reloaded);
  assert.equal(reloaded.snapshot().profile.activeInstance, null);
  assert.notEqual(await openAnswer(reloaded, supply, 0, 7), route);
});
await test('failed answer write does not advance route or fabricate success', async () => {
  const { controller, store } = await setup();
  await openAnswer(controller, supply, 0, 3);
  const before = controller.snapshot();
  store.fail = true;
  await assert.rejects(
    controller.answer({
      instanceId: before.profile.activeInstance.instanceId,
      response: { optionIds: ['o1'] },
    }),
    /STORAGE_FAILURE/,
  );
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
});
await test('all four sections isolate routes and resume exact persisted instances', async () => {
  const { controller, store } = await setup();
  const saved = [];
  for (const section of ['letters', 'syllables', 'words', 'sentences']) {
    const tasks = answerItems(supply, 12, section);
    assert.ok(tasks.length > 0, section);
    const routeId = await openAnswer(controller, supply, 12, 3, false, section);
    assert.ok(routeId.startsWith(`answer:${section}:12:`));
    const state = controller.snapshot();
    const instanceId = state.profile.activeInstance.instanceId;
    assert.ok(
      tasks.some((task) => task.id === state.profile.activeInstance.itemId),
    );
    assert.ok(
      state.customRoutes[routeId].steps.every((step) =>
        tasks.some((task) => task.id === step.itemId),
      ),
    );
    assert.equal(controller.visible().optionsRevealed, true);
    saved.push({ section, routeId, instanceId });
    await controller.leaveSession();
  }
  assert.equal(new Set(saved.map((item) => item.routeId)).size, 4);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  // Resume in reverse order after other sections ran, with a different requested length.
  for (const { section, routeId, instanceId } of [...saved].reverse()) {
    assert.equal(
      await openAnswer(reloaded, supply, 12, 7, false, section),
      routeId,
    );
    assert.equal(
      reloaded.snapshot().profile.activeInstance.instanceId,
      instanceId,
    );
    assert.equal(reloaded.snapshot().customRoutes[routeId].steps.length, 3);
    await reloaded.leaveSession();
  }
  const words = saved.find((item) => item.section === 'words');
  assert.equal(
    await openAnswer(reloaded, supply, 12, 5),
    words.routeId,
    'omitted section still resumes the existing word route',
  );
});
await test('sentence pools enforce topic letters in both target and every answer option', () => {
  const candidates = trainerItems(supply, 'choice', 'sentences');
  assert.ok(candidates.length > 0);
  let optionOnlyExclusions = 0;
  for (let unit = 0; unit < levels.length; unit++) {
    const alphabet = new Set(levels[unit].letters);
    const allowed = (text) =>
      [...text.toUpperCase()].every(
        (letter) => !/[А-ЯЁ]/u.test(letter) || alphabet.has(letter),
      );
    const eligibleTargets = candidates.filter(
      (task) => allowed(task.requiredLetters) && allowed(task.learnerText),
    );
    const expected = eligibleTargets.filter((task) =>
      task.options.every((option) => allowed(option.text)),
    );
    optionOnlyExclusions += eligibleTargets.length - expected.length;
    const actual = answerItems(supply, unit, 'sentences');
    assert.deepEqual(
      actual.map((task) => task.id).sort(),
      expected.map((task) => task.id).sort(),
      `unit ${unit}`,
    );
  }
  assert.ok(
    optionOnlyExclusions > 0,
    'the authored bank exercises an option outside the target alphabet',
  );
});
assert.equal(
  JSON.stringify(supply.curriculum.items),
  originalBank,
  'Authored source tasks remain unchanged',
);
console.log(`${passed} answer session tests PASS`);
