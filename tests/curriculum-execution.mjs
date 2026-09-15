import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';

const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { createState } = await mod('lib/progress/state.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { RevisionConflict } = await mod('lib/progress/indexed-db.js');
const { engine, routeEngine } = await mod('lib/curriculum/core.js');
const supply = await loadSupply(...supplyText());
const curriculum = supply.curriculum;
const tasks = Object.values(curriculum.items);
const legacy = { getItem() { return null; } };
class MemoryStore {
  state = null;
  rejectCommit = false;
  async read() { return structuredClone(this.state); }
  async commit(next, expected) {
    validateState(next, supply);
    if (this.rejectCommit) throw new Error('TEST_STORAGE_FAILURE');
    if ((this.state?.storageRevision ?? null) !== expected) throw new RevisionConflict();
    this.state = structuredClone({ ...next, storageRevision: (this.state?.storageRevision ?? -1) + 1 });
    return this.read();
  }
}
async function opened(initial) {
  const store = new MemoryStore();
  if (initial) await store.commit(initial, null);
  const controller = await CurriculumController.open(supply, store, legacy);
  await controller.beginVisit('execution-visit', 7);
  return { store, controller };
}
function officialFixture(episode, stepIndex = 0) {
  const state = createState(supply, legacy, 'synthetic-execution-test');
  const node = curriculum.nodes[episode.nodeId];
  state.profile = engine.switchProgram(state.profile, episode.programId, curriculum);
  state.profile.knownLetters = [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
  for (const skill of node.prerequisiteSkills) {
    state.profile = engine.confirmEntrySkill(state.profile, curriculum, skill, { verifier: 'companion', reason: 'SYNTHETIC TEST FIXTURE' });
  }
  state.profile = routeEngine.chooseEntry(state.profile, curriculum, node.id);
  const position = state.profile.programs[episode.programId];
  position.episodeIndex = node.episodeIds.indexOf(episode.id);
  position.stepIndex = stepIndex;
  position.contextFrameShown = true;
  state.studyMode = 'recommended';
  state.route = { source: 'recommended', routeId: episode.programId, version: 1 };
  return state;
}
let passed = 0;
async function test(name, run) {
  await run();
  console.log('PASS ' + name);
  passed++;
}
const transform = tasks.find((task) => task.kind === 'transform' && task.requiresFollowupReading);

for (const custom of [false, true]) {
  await test((custom ? 'custom' : 'free') + ' transform saves raw text and completes only its restored reading stage', async () => {
    const { controller, store } = await opened();
    if (custom) {
      await controller.registerCustomRoute({ source: 'custom', routeId: 'transform-route', version: 1, position: 0, suspendedInstance: null, steps: [{ id: 'transform-step', itemId: transform.id, mode: 'read' }] });
      await controller.selectCustomRoute('transform-route');
      await controller.launch(await controller.planNext(), 'transform-instance');
    } else await controller.launchFree(transform.id, 'read', 'transform-instance');
    const before = controller.snapshot();
    await assert.rejects(controller.answer({ instanceId: 'stale-instance', response: { text: 'ЧУЖОЙ ОТВЕТ' } }), /[Ss]tale|INSTANCE/i);
    assert.deepEqual(controller.snapshot(), before);
    await controller.answer({ instanceId: 'transform-instance', response: { text: transform.answer.value } });
    const staged = controller.snapshot();
    assert.equal(staged.profile.activeInstance.instanceId, 'transform-instance');
    assert.equal(staged.profile.activeInstance.transformText, transform.answer.value);
    assert.equal(staged.profile.receipts['transform-instance'], undefined);
    assert.equal(staged.profile.currentVisit.actions, before.profile.currentVisit.actions);
    if (custom) assert.equal(staged.customRoutes['transform-route'].position, 0);
    const reloaded = await CurriculumController.open(supply, store, legacy);
    assert.deepEqual(reloaded.visible(), controller.visible());
    assert.equal(reloaded.visible().transformFollowup, true);
    assert.equal(reloaded.visible().transformText, transform.answer.value);
    for (const response of [
      { text: transform.answer.value },
      { text: transform.answer.value + '!', reading: { verifier: 'companion', correct: true } },
    ]) {
      await assert.rejects(reloaded.answer({ instanceId: 'transform-instance', response }), /TRANSFORM_READING_REQUIRED/);
      assert.deepEqual(reloaded.snapshot(), staged);
      assert.deepEqual(await store.read(), staged);
    }
    await reloaded.answer({ instanceId: 'transform-instance', response: { text: transform.answer.value, reading: { verifier: 'companion', correct: true } } });
    const completed = reloaded.snapshot();
    assert.equal(completed.profile.activeInstance, null);
    assert.equal(completed.profile.receipts['transform-instance'].outcome, 'correct');
    const attempt = completed.profile.attempts.at(-1);
    assert.equal(attempt.decodingTransfer, false);
    assert.equal(attempt.readingVerified, false);
    assert.deepEqual(completed.profile.confirmedSkills, before.profile.confirmedSkills);
    if (custom) assert.equal(completed.customRoutes['transform-route'].position, 1);
  });
}

await test('official transform advances to its authored reading step without an extra followup', async () => {
  const episode = Object.values(curriculum.episodes).find((entry) => entry.steps.some((step, index) => curriculum.items[step.itemId]?.kind === 'transform' && curriculum.items[entry.steps[index + 1]?.itemId]?.kind === 'read'));
  const index = episode.steps.findIndex((step, position) => curriculum.items[step.itemId]?.kind === 'transform' && curriculum.items[episode.steps[position + 1]?.itemId]?.kind === 'read');
  const task = curriculum.items[episode.steps[index].itemId];
  const { controller } = await opened(officialFixture(episode, index));
  await controller.launch(await controller.planNext(), 'official-transform');
  assert.equal(controller.visible().transformFollowup, false);
  await controller.answer({ instanceId: 'official-transform', response: { text: task.answer.value } });
  assert.ok(controller.snapshot().profile.receipts['official-transform']);
  assert.equal(controller.snapshot().profile.activeInstance, null);
  await controller.launch(await controller.planNext(), 'authored-reading');
  const active = controller.snapshot().profile.activeInstance;
  assert.equal(active.stepId, episode.steps[index + 1].id);
  assert.equal(active.itemId, episode.steps[index + 1].itemId);
  assert.equal(controller.visible().taskKind, 'read');
  assert.equal(controller.snapshot().profile.currentVisit.actions, 2);
});

await test('information audio returns authored speech only after saving exposure', async () => {
  const episode = Object.values(curriculum.episodes).find((entry) => entry.steps.some((step) => step.action === 'meaning_anchor' && step.spokenText !== step.visibleText));
  const index = episode.steps.findIndex((step) => step.action === 'meaning_anchor' && step.spokenText !== step.visibleText);
  const { controller, store } = await opened(officialFixture(episode, index));
  await controller.launch(await controller.planNext());
  const before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(controller.informationAudio(), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
  store.rejectCommit = false;
  const audio = await controller.informationAudio();
  assert.equal(audio, episode.steps[index].spokenText);
  assert.ok(store.state.profile.exposures.stimuli.includes(engine.normalise(audio)));
  assert.equal(store.state.storageRevision, before.storageRevision + 1);
});

await test('generic help exposes authored hints with their text already in saved history', async () => {
  const task = tasks.find((entry) => entry.hints.length && (entry.hintLevels?.[0] ?? 1) === 1 && entry.allowedModes.includes('read'));
  const { controller, store } = await opened();
  await controller.launchFree(task.id, 'read', 'help-instance');
  const before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(controller.help({ level: 1 }), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(controller.visible().hints, []);
  store.rejectCommit = false;
  const view = await controller.help({ level: 1 });
  assert.ok(view.hints.length);
  for (const hint of view.hints) assert.ok(store.state.profile.exposures.stimuli.includes(engine.normalise(hint)));
  assert.ok(store.state.profile.exposures.events.some((event) => event.promptedTexts.includes(engine.normalise(task.learnerText))));
});

console.log('Curriculum execution: ' + passed + ' scenarios passed');
