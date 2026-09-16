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
assert.equal(
  JSON.stringify(supply.curriculum.items),
  originalBank,
  'Authored source tasks remain unchanged',
);
console.log(`${passed} answer session tests PASS`);
