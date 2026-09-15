import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';

const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { presentation } = await mod('features/curriculum/presentation.js');
const { tokenOrder } = await mod('features/curriculum/token-order.js');
const { RevisionConflict } = await mod('lib/progress/indexed-db.js');
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
async function opened() {
  const store = new MemoryStore();
  const controller = await CurriculumController.open(supply, store, legacy);
  await controller.beginVisit('presentation-visit', 7);
  return { store, controller };
}
async function launched(task, instanceId = 'presentation-instance') {
  const state = await opened();
  await state.controller.launchFree(task.id, 'read', instanceId);
  return state;
}
let passed = 0;
async function test(name, run) {
  await run();
  console.log('PASS ' + name);
  passed++;
}
const forbidden = new Set(['answer', 'correctOptionIds', 'acceptedBoundaries', 'partsAfterAnswer', 'resultText', 'feedback', 'joined', 'expected', 'skillIds', 'targetWord']);
function noKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, 'key leaked: ' + key);
    noKeys(child);
  }
}

await test('task projection withholds keys and future hints across every actual task kind', async () => {
  for (const kind of new Set(tasks.map((task) => task.kind))) {
    const task = tasks.find((entry) => entry.kind === kind && entry.allowedModes.includes('read'));
    const { controller } = await launched(task);
    const visible = controller.visible();
    noKeys(visible);
    assert.deepEqual(visible.hints, []);
    assert.deepEqual(visible.options, []);
    assert.deepEqual(visible.questions, []);
    assert.equal(visible.answerKind, task.answer.kind);
    assert.equal(visible.text, task.learnerText);
    if (kind !== 'compose') assert.deepEqual(visible.tokens, []);
  }
});

await test('authored show_chunks hides whole target and meaning separates spoken definition', async () => {
  const { controller } = await opened();
  await controller.selectProgram(curriculum.programs[0].id);
  await controller.launch(await controller.planNext());
  const chunks = controller.visible();
  assert.equal(chunks.kind, 'info');
  assert.ok(chunks.texts.includes('М | А'));
  assert.equal(chunks.texts.includes('МА'), false);
  noKeys(chunks);
  const episode = Object.values(curriculum.episodes).find((entry) => entry.steps.some((step) => step.action === 'meaning_anchor' && step.visibleText === 'МАК'));
  const step = episode.steps.find((entry) => entry.action === 'meaning_anchor' && entry.visibleText === 'МАК');
  const profile = controller.snapshot().profile;
  profile.programs[profile.currentProgramId].activeInfo = { kind: 'episode_info', episodeId: episode.id, stepId: step.id, planId: 'meaning-projection' };
  const meaning = presentation(profile, supply);
  assert.deepEqual(meaning.texts, ['МАК']);
  assert.deepEqual(meaning.spokenTexts, [step.spokenText]);
  assert.equal(meaning.texts.includes(step.spokenText), false);
  noKeys(meaning);
});

await test('compose preserves repeated token identity and saves deterministic order on reload', async () => {
  const task = tasks.find((entry) => entry.kind === 'compose' && new Set(entry.partTokens.map((token) => token.text)).size < entry.partTokens.length);
  const { controller, store } = await launched(task, 'repeated-tokens');
  const visible = controller.visible();
  assert.equal(visible.tokens.length, task.partTokens.length);
  assert.equal(new Set(visible.tokens.map((token) => token.tokenId)).size, task.partTokens.length);
  assert.deepEqual(visible.selectedAnswers, {});
  assert.deepEqual(controller.snapshot().profile.activeInstance.tokenOrder, visible.tokens.map((token) => token.tokenId));
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.visible(), visible);
  const invalid = JSON.parse(await controller.export());
  invalid.state.profile.activeInstance.tokenOrder = Array(task.partTokens.length).fill(task.partTokens[0].tokenId);
  await assert.rejects(controller.import(JSON.stringify(invalid)), /token/i);
  assert.deepEqual(controller.visible(), visible);
});

await test('compose order depends on instance and authored space joiner is preserved', async () => {
  const task = tasks.find((entry) => entry.kind === 'compose' && entry.answer.joiner === ' ');
  const { controller } = await launched(task, 'joiner-instance');
  assert.equal(controller.visible().joiner, ' ');
  const instance = controller.snapshot().profile.activeInstance;
  const orders = new Set();
  for (let index = 0; index < 12; index++) {
    const candidate = { ...instance, instanceId: 'shuffle-' + index };
    delete candidate.tokenOrder;
    const order = tokenOrder(candidate, supply);
    assert.deepEqual(tokenOrder(candidate, supply), order);
    orders.add(JSON.stringify(order));
  }
  assert.ok(orders.size > 1, 'tokens must not always retain authored answer order');
  await controller.answer({ instanceId: instance.instanceId, response: { tokenIds: task.partTokens.map((token) => token.tokenId) } });
  assert.equal(controller.snapshot().profile.receipts[instance.instanceId].outcome, 'correct');
  assert.equal(controller.snapshot().profile.attempts.at(-1).readingVerified, false);
});

await test('authored first hint level four is persisted before hint becomes visible', async () => {
  const task = tasks.find((entry) => entry.hintLevels?.[0] === 4 && entry.allowedModes.includes('read'));
  const { controller, store } = await launched(task, 'hint-instance');
  const before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(controller.hint(0), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(controller.visible().hints, []);
  store.rejectCommit = false;
  await controller.hint(0);
  assert.equal(controller.visible().helpLevel, 4);
  assert.ok(controller.visible().hints.includes(task.hints[0]));
  assert.ok(store.state.profile.exposures.events.some((event) => event.promptedTexts.length > 0));
  noKeys(controller.visible());
});

await test('reading-meaning options require reading and survive failed reveal without leaking', async () => {
  const task = tasks.find((entry) => entry.kind === 'read_meaning');
  const { controller, store } = await launched(task, 'meaning-instance');
  await assert.rejects(controller.revealOptions(), /READING_STAGE_REQUIRED/);
  await controller.recordReading('meaning-instance', { verifier: 'companion', correct: true });
  await assert.rejects(controller.answer({ instanceId: 'meaning-instance', response: { optionIds: task.answer.correctOptionIds } }), /STAGES_REQUIRED/);
  store.rejectCommit = true;
  await assert.rejects(controller.revealOptions(), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.visible().options, []);
  assert.equal(controller.visible().optionsRevealed, false);
  store.rejectCommit = false;
  await controller.revealOptions();
  assert.deepEqual(controller.visible().options.map((option) => option.id), store.state.profile.activeInstance.optionOrder.task);
  noKeys(controller.visible());
});

await test('passage partial restores same instance, selected question and persisted option order', async () => {
  const task = tasks.find((entry) => entry.kind === 'passage' && entry.answer.questions.length > 1);
  const { controller, store } = await launched(task, 'partial-passage');
  await assert.rejects(controller.revealOptions(), /READING_STAGE_REQUIRED/);
  await controller.recordReading('partial-passage');
  await controller.revealOptions();
  const first = task.answer.questions[0];
  await controller.answer({ instanceId: 'partial-passage', response: { answers: { [first.id]: first.correctOptionIds } } });
  const snapshot = controller.snapshot();
  assert.equal(snapshot.profile.activeInstance.instanceId, 'partial-passage');
  assert.equal(snapshot.profile.receipts['partial-passage'], undefined);
  assert.equal(snapshot.profile.currentVisit.actions, 1);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.visible(), controller.visible());
  assert.deepEqual(reloaded.visible().selectedAnswers[first.id], first.correctOptionIds);
  for (const question of reloaded.visible().questions) {
    assert.deepEqual(question.options.map((option) => option.id), snapshot.profile.activeInstance.optionOrder[question.id]);
  }
  noKeys(reloaded.visible());
});

await test('function reading and span tasks expose the required raw-input shape without keys', async () => {
  const functionTask = tasks.find((entry) => entry.answer.kind === 'companion_function' && entry.allowedModes.includes('read'));
  const { controller } = await launched(functionTask);
  assert.deepEqual(controller.visible().functionCheck, { capabilityId: functionTask.answer.capabilityId, criterion: functionTask.answer.criterion });
  noKeys(controller.visible());
  const spanTask = tasks.find((entry) => entry.kind === 'find_part');
  const span = await launched(spanTask);
  assert.deepEqual(span.controller.visible().lines, spanTask.lines);
  assert.equal(span.controller.visible().answerKind, 'spans');
  noKeys(span.controller.visible());
});

console.log('Curriculum presentation: ' + passed + ' scenarios passed');
