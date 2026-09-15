import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum(),
  mod = (p) => import(pathToFileURL(output + '/' + p));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { exposureInput } = await mod('lib/curriculum/free-exposure.js');
const supply = await loadSupply(...supplyText()),
  c = supply.curriculum;
class Store {
  state = null;
  fail = false;
  wait = null;
  async read() {
    return structuredClone(this.state);
  }
  async commit(next, expected) {
    validateState(next, supply);
    if (this.wait) await this.wait;
    if (this.fail) throw new Error('STORAGE_FAILURE');
    if ((this.state?.storageRevision ?? null) !== expected)
      throw new Error('REVISION_CONFLICT');
    this.state = {
      ...structuredClone(next),
      storageRevision: (expected ?? -1) + 1,
    };
    return this.read();
  }
}
const legacy = { getItem: () => null };
async function setup() {
  const store = new Store();
  return {
    store,
    controller: await CurriculumController.open(supply, store, legacy),
  };
}
let passed = 0;
async function test(name, run) {
  await run();
  console.log('PASS ' + name);
  passed++;
}
await test('free display records exact item/family with no attempt or course movement', async () => {
  const { controller } = await setup();
  await controller.selectProgram(c.programs[0].id);
  await controller.selectProgram(c.programs[1].id);
  const before = controller.snapshot(),
    item = Object.values(c.items).find((x) => x.learnerText.length > 4);
  await controller.recordFreeExposure({ texts: [item.learnerText] });
  const after = controller.snapshot();
  assert.deepEqual(after.profile.programs, before.profile.programs);
  assert.deepEqual(after.profile.attempts, before.profile.attempts);
  assert.deepEqual(after.profile.skillBasis, before.profile.skillBasis);
  assert.deepEqual(after.profile.currentVisit, before.profile.currentVisit);
  assert.deepEqual(after.profile.activeInstance, before.profile.activeInstance);
  assert.deepEqual(after.legacy, before.legacy);
  assert.ok(after.profile.exposures.itemIds.includes(item.id));
  assert.ok(after.profile.exposures.families.includes(item.exposureFamily));
});
await test('hidden picture target registers help without claiming written display', async () => {
  const { controller } = await setup();
  await controller.recordFreeExposure({ promptedTexts: ['КОТ'] });
  const e = controller.snapshot().profile.exposures;
  assert.equal(e.stimuli.includes('КОТ'), false);
  assert.deepEqual(e.events.at(-1).promptedTexts, ['КОТ']);
});
await test('same-target auditory assistance and whole heard passage remain separate', async () => {
  const { controller } = await setup();
  const item = Object.values(c.items).find((x) => x.kind === 'passage');
  await controller.recordFreeExposure({
    texts: [item.learnerText],
    promptedTexts: [item.learnerText],
    heardPassages: [item.learnerText],
  });
  const e = controller.snapshot().profile.exposures;
  assert.equal(e.heardPassages.length, 1);
  assert.equal(e.events.at(-1).promptedTexts.length, 1);
});
await test('partial lines do not pretend to be a whole passage', () => {
  const item = Object.values(c.items).find(
    (x) => x.kind === 'passage' && x.learnerText.split(' ').length > 4,
  );
  assert.ok(item);
  const partial = exposureInput(supply, {
    texts: [item.learnerText.split(' ').slice(0, 2).join(' ')],
  });
  assert.ok(!partial.itemIds.includes(item.id));
  const full = exposureInput(supply, { texts: [item.learnerText] });
  assert.ok(full.itemIds.includes(item.id));
});
await test('normalisation preserves Ё versus Е and hard/soft signs', () => {
  const item = Object.values(c.items).find(
    (x) => x.learnerText.includes('ё') || x.learnerText.includes('Ё'),
  );
  assert.ok(item);
  const changed = item.learnerText.replaceAll('ё', 'е').replaceAll('Ё', 'Е');
  assert.ok(
    !exposureInput(supply, { texts: [changed] }).itemIds.includes(item.id),
  );
  assert.ok(
    exposureInput(supply, { texts: [item.learnerText] }).itemIds.includes(
      item.id,
    ),
  );
});
await test('failed persistence leaves exposures and revision unchanged', async () => {
  const { controller, store } = await setup(),
    before = controller.snapshot();
  store.fail = true;
  await assert.rejects(
    controller.recordFreeExposure(['САНИ']),
    /STORAGE_FAILURE/,
  );
  assert.deepEqual(controller.snapshot(), before);
});
await test('exposure only becomes visible after commit completes', async () => {
  const { controller, store } = await setup(),
    before = controller.snapshot();
  let release;
  store.wait = new Promise((resolve) => (release = resolve));
  const pending = controller.recordFreeExposure(['САНИ']);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(controller.snapshot(), before);
  release();
  await pending;
  assert.ok(controller.snapshot().profile.exposures.words.includes('САНИ'));
});
await test('another tab cannot overwrite newer exposure history', async () => {
  const { controller, store } = await setup();
  const second = await CurriculumController.open(supply, store, legacy);
  await controller.recordFreeExposure(['КОТ']);
  await assert.rejects(second.recordFreeExposure(['ДОМ']), /REVISION_CONFLICT/);
  await second.refresh();
  await second.recordFreeExposure(['ДОМ']);
  assert.ok((await store.read()).profile.exposures.words.includes('КОТ'));
});
await test('real interests update preference only, preserve positions and reject invented tags', async () => {
  const { controller } = await setup();
  await controller.selectProgram(c.programs[0].id);
  const before = controller.snapshot(),
    tag = Object.values(c.items).flatMap((x) => x.interestTags)[0];
  await controller.updateInterests([tag]);
  const after = controller.snapshot();
  assert.deepEqual(after.profile.programs, before.profile.programs);
  assert.deepEqual(after.profile.interests, [tag]);
  assert.deepEqual(after.onboarding.questionnaire.interests, [tag]);
  await assert.rejects(
    controller.updateInterests(['invented_tag']),
    /INVALID_INTERESTS/,
  );
});
await test('malformed input cannot write invalid exposure records', async () => {
  const { controller } = await setup(),
    before = controller.snapshot();
  await assert.rejects(
    controller.recordFreeExposure({ texts: [null] }),
    /INVALID_EXPOSURE/,
  );
  assert.deepEqual(controller.snapshot(), before);
});
console.log(passed + ' free-practice scenarios passed');
