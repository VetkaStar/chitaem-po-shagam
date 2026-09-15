import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { RevisionConflict } = await mod('lib/progress/indexed-db.js');
const supply = await loadSupply(...supplyText()),
  curriculum = supply.curriculum;
const legacy = {
  getItem() {
    return null;
  },
};
class MemoryStore {
  state = null;
  rejectCommit = false;
  writes = 0;
  async read() {
    return structuredClone(this.state);
  }
  async commit(next, expected) {
    validateState(next, supply);
    if (this.rejectCommit) throw new Error('TEST_STORAGE_FAILURE');
    if ((this.state?.storageRevision ?? null) !== expected)
      throw new RevisionConflict();
    this.state = structuredClone({
      ...next,
      storageRevision: (this.state?.storageRevision ?? -1) + 1,
    });
    this.writes++;
    return this.read();
  }
}
async function setup() {
  const store = new MemoryStore();
  return {
    store,
    controller: await CurriculumController.open(supply, store, legacy),
  };
}
function answers(controller, extra = {}) {
  return {
    ...controller.snapshot().onboarding.questionnaire,
    respondent: 'adult',
    reads: ['syllables'],
    companionAvailable: true,
    visualTextUsable: true,
    canUseButtons: true,
    canUseKeyboard: true,
    companionCanSelect: true,
    instructionsReadable: true,
    audioUsable: true,
    program: curriculum.programs[0].id,
    letterPairs: [],
    budget: 7,
    ...extra,
  };
}
async function ready(controller, extra = {}) {
  await controller.resumeSetup();
  const q = answers(controller, extra);
  await controller.saveQuestionnaire(q, null);
  await controller.continueQuestionnaire();
  await controller.saveAccess(q);
  await controller.answerAccess('circle');
  await controller.startEntryCheck();
}
function checkpoint(controller) {
  const o = controller.snapshot().onboarding;
  return o.entry.checkpoints.find((cp) => cp.id === o.checkpointId);
}
async function probe(
  controller,
  id,
  response = { reading: { verifier: 'companion', correct: true } },
  observed = true,
) {
  const plan = await controller.planNext();
  assert.equal(plan.kind, 'entry_task');
  await controller.launch(plan, id, observed);
  await controller.answer({ instanceId: id, response });
}
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('PASS ' + name);
  passed++;
}

await test('UI access errors do not launch probes or assign skills and can be corrected explicitly', async () => {
  const { controller } = await setup();
  await controller.resumeSetup();
  const q = answers(controller);
  await controller.saveQuestionnaire(q, null);
  await controller.continueQuestionnaire();
  await controller.saveAccess(q);
  await assert.rejects(controller.startEntryCheck(), /UI_ACCESS_REQUIRED/);
  await controller.answerAccess('square');
  await controller.answerAccess('square');
  await assert.rejects(
    controller.answerAccess('circle'),
    /ACCESS_SETUP_REQUIRED/,
  );
  assert.deepEqual(controller.snapshot().profile.attempts, []);
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
  await controller.saveAccess({ ...q, visualTextUsable: false });
  await controller.answerAccess('circle');
  await assert.rejects(controller.startEntryCheck(), /UI_ACCESS_REQUIRED/);
  await controller.saveAccess(q);
  await controller.answerAccess('circle');
  await controller.startEntryCheck();
  assert.equal(controller.snapshot().onboarding.currentCheckpointGroup, 'CVC');
});

await test('one success is pending; two CVC proofs confirm only decode.cvc and request CV', async () => {
  const { controller, store } = await setup();
  await ready(controller);
  const originalPositions = controller.snapshot().profile.programs;
  await probe(controller, 'cvc-first');
  assert.equal(checkpoint(controller).observations.length, 1);
  await assert.rejects(
    controller.finishEntryGroup(true),
    /ENTRY_GROUP_PENDING/,
  );
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
  await probe(controller, 'cvc-second');
  await controller.finishEntryGroup(true);
  const first = controller.snapshot();
  assert.deepEqual(first.profile.confirmedSkills, ['decode.cvc']);
  assert.deepEqual(first.profile.programs, originalPositions);
  assert.equal(
    first.onboarding.entry.placement.kind,
    'entry_checkpoint_needed',
  );
  assert.equal(first.onboarding.entry.placement.next.groupId, 'CV');
  assert.equal(first.onboarding.rootGoalGroup, 'CV2');
  await controller.requestPrerequisite();
  assert.equal(checkpoint(controller).purpose, 'prerequisite');
  await probe(controller, 'cv-first');
  await probe(controller, 'cv-second');
  await controller.finishEntryGroup(true);
  const placed = controller.snapshot();
  assert.equal(placed.onboarding.rootGoalGroup, 'CV2');
  assert.equal(placed.onboarding.entry.placement.kind, 'formal_route');
  assert.equal(placed.onboarding.entry.placement.startNodeId, 'p1.C01');
  assert.equal(
    placed.profile.programs[curriculum.programs[0].id].nodeId,
    'p1.C01',
  );
  assert.deepEqual(placed.profile.knownLetters, []);
  assert.deepEqual(placed.profile.reviewQueue, []);
  assert.equal(placed.onboarding.entry.placement.profileToPersist, undefined);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.snapshot(), placed);
  await reloaded.acceptPlacement();
  await reloaded.launch(await reloaded.planNext());
  assert.equal(reloaded.visible().kind, 'info');
});

await test('no companion uses exact provisional practice without entry observations or course movement', async () => {
  const { controller } = await setup();
  await ready(controller, { companionAvailable: false });
  const start = controller.snapshot(),
    placement = start.onboarding.entry.placement;
  assert.equal(placement.kind, 'provisional_free');
  assert.equal(placement.reason, 'NO_COMPANION');
  assert.equal(placement.startNodeId, null);
  assert.deepEqual(
    placement.orderedTaskIds,
    supply.registry.groups.CVC.orderedItemIds.slice(0, 3),
  );
  await controller.startEntryPractice();
  assert.equal((await controller.planNext()).kind, 'entry_practice');
  await controller.launch(await controller.planNext(), 'practice-only');
  await controller.answer({
    instanceId: 'practice-only',
    response: { text: 'КОТ' },
  });
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
  assert.deepEqual(
    controller.snapshot().profile.programs,
    start.profile.programs,
  );
  assert.deepEqual(checkpoint(controller).observations, []);
  assert.equal(controller.snapshot().onboarding.entry.practice.position, 1);
});

await test('text/ASR alone is unassessed and two technical failures defer the checkpoint', async () => {
  const { controller } = await setup();
  await ready(controller);
  await probe(controller, 'asr-text', { text: 'КОТ' });
  assert.equal(checkpoint(controller).observations[0].result, 'unassessed');
  assert.equal(checkpoint(controller).observations[0].reason, 'uncertain');
  const plan = await controller.planNext();
  await controller.launch(plan, 'input-error', true);
  await controller.answer({
    instanceId: 'input-error',
    disposition: 'input_error',
  });
  assert.equal((await controller.planNext()).kind, 'entry_deferred');
  await controller.deferEntryCheck();
  assert.equal(
    controller.snapshot().onboarding.entry.placement.reason,
    'ENTRY_DEFERRED',
  );
  assert.ok(controller.snapshot().onboarding.deferredGroups.includes('CVC'));
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
});

await test('passage partial restores instance, frozen metadata and question order without an observation', async () => {
  const { controller, store } = await setup();
  await ready(controller, { reads: ['texts'] });
  await controller.launch(await controller.planNext(), 'subject-partial', true);
  const active = controller.snapshot().profile.activeInstance,
    task = curriculum.items[active.itemId];
  const metadata = structuredClone(
    checkpoint(controller).metadata['subject-partial'],
  );
  assert.equal(metadata.freshPassageBeforeShow, true);
  await controller.recordReading(active.instanceId, {
    verifier: 'companion',
    correct: true,
  });
  await controller.revealOptions();
  const q = task.answer.questions[0];
  await controller.answer({
    instanceId: active.instanceId,
    response: { answers: { [q.id]: q.correctOptionIds } },
  });
  assert.equal(
    controller.snapshot().profile.activeInstance.instanceId,
    active.instanceId,
  );
  assert.deepEqual(checkpoint(controller).observations, []);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.visible(), controller.visible());
  assert.deepEqual(checkpoint(reloaded).metadata[active.instanceId], metadata);
  await reloaded.answer({
    instanceId: active.instanceId,
    response: {
      answers: Object.fromEntries(
        task.answer.questions.map((entry) => [
          entry.id,
          entry.correctOptionIds,
        ]),
      ),
    },
  });
  assert.equal(checkpoint(reloaded).observations.length, 1);
  assert.equal(checkpoint(reloaded).observations[0].result, 'pass');
});

await test('checkpoints do not combine CVC with CV2 or older CVC retests', async () => {
  const { controller } = await setup();
  await ready(controller);
  await probe(controller, 'isolated-cvc-1');
  await ready(controller, { reads: ['short_words'] });
  await probe(controller, 'isolated-cv2');
  await assert.rejects(
    controller.finishEntryGroup(true),
    /ENTRY_GROUP_PENDING/,
  );
  await ready(controller);
  await probe(controller, 'isolated-cvc-2');
  await assert.rejects(
    controller.finishEntryGroup(true),
    /ENTRY_GROUP_PENDING/,
  );
  assert.equal(controller.snapshot().onboarding.entry.checkpoints.length, 3);
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
});

await test('choice evidence without an observing companion cannot be confirmed', async () => {
  const { controller } = await setup();
  await ready(controller, { reads: ['letters'], letterPairs: ['LP'] });
  await probe(controller, 'side-cv-1');
  await probe(controller, 'side-cv-2');
  await controller.finishEntryGroup(true);
  await controller.requestSideCheck();
  assert.equal(checkpoint(controller).groupId, 'LP_SIGN');
  for (let index = 0; index < 2; index++) {
    await controller.launch(
      await controller.planNext(),
      'lp-unobserved-' + index,
      false,
    );
    const t =
      curriculum.items[controller.snapshot().profile.activeInstance.itemId];
    await controller.answer({
      instanceId: 'lp-unobserved-' + index,
      response: { optionIds: t.answer.correctOptionIds },
    });
  }
  await assert.rejects(
    controller.finishEntryGroup(true),
    /ENTRY_CONFIRMATION_UNAVAILABLE|ENTRY_GROUP_PENDING/,
  );
  assert.equal(
    controller.snapshot().profile.confirmedSkills.includes('letter.lp'),
    false,
  );
});

await test('help and memorised recognition do not confirm reading; duplicate result is idempotent', async () => {
  const { controller } = await setup();
  await ready(controller);
  await controller.launch(await controller.planNext(), 'memorised', true);
  await controller.markEntryMemorised('memorised', true);
  await controller.answer({
    instanceId: 'memorised',
    response: { reading: { verifier: 'companion', correct: true } },
  });
  assert.equal(
    checkpoint(controller).observations[0].reason,
    'recognition_not_decoding',
  );
  await controller.launch(await controller.planNext(), 'assisted', true);
  await controller.help({ level: 1 });
  const answer = {
    instanceId: 'assisted',
    response: { reading: { verifier: 'companion', correct: true } },
  };
  await controller.answer(answer);
  const after = controller.snapshot();
  await controller.answer(answer);
  assert.deepEqual(controller.snapshot(), after);
  assert.equal(checkpoint(controller).observations[1].result, 'assisted');
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
});

await test('budget pause from resolvePlacement persists returned program position without preview visit', async () => {
  const { controller, store } = await setup();
  await controller.beginVisit('real-budget-visit', 3);
  const freeTask = Object.values(curriculum.items).find(
    (t) => t.kind === 'read',
  );
  await controller.launchFree(freeTask.id, 'read', 'prior-free');
  await controller.answer({ instanceId: 'prior-free', disposition: 'skipped' });
  await ready(controller, { reads: ['letters'], budget: 3 });
  await probe(controller, 'budget-cv-1');
  await probe(controller, 'budget-cv-2');
  await controller.finishEntryGroup(true);
  const state = controller.snapshot();
  assert.equal(state.onboarding.entry.placement.kind, 'engine_action');
  assert.equal(state.onboarding.entry.placement.next.kind, 'pause');
  assert.equal(state.profile.currentVisit.id, 'real-budget-visit');
  assert.equal(state.profile.currentVisit.actions, 3);
  assert.equal(
    state.profile.programs[curriculum.programs[0].id].nodeId,
    'p1.A03',
  );
  assert.deepEqual(await store.read(), state);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  await reloaded.acceptPlacement();
  assert.equal((await reloaded.planNext()).kind, 'pause');
});

await test('failed entry launch and stale plan expose no card or checkpoint metadata', async () => {
  const { controller, store } = await setup();
  await ready(controller);
  const plan = await controller.planNext(),
    before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(
    controller.launch(plan, 'failed-entry', true),
    /TEST_STORAGE_FAILURE/,
  );
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
  assert.equal(controller.visible(), null);
  store.rejectCommit = false;
  await controller.saveQuestionnaire(
    controller.snapshot().onboarding.questionnaire,
    null,
  );
  await assert.rejects(
    controller.launch(plan, 'stale-entry', true),
    /STALE_PLAN/,
  );
  assert.deepEqual(checkpoint(controller).metadata, {});
});

await test('entry import rejects forged observation, hash, group and confirmation without writing', async () => {
  const { controller, store } = await setup();
  await ready(controller);
  await probe(controller, 'import-proof');
  const before = await controller.export(),
    writes = store.writes;
  const getCheckpoint = (s) => s.onboarding.entry.checkpoints[0];
  const edits = [
    (s) => {
      getCheckpoint(s).groupId = 'FACT3';
    },
    (s) => {
      getCheckpoint(s).metadata['import-proof'].contentHash = 'bad-hash';
    },
    (s) => {
      getCheckpoint(s).observations[0].result = 'fail';
    },
    (s) => {
      getCheckpoint(s).observations[0].instanceId = 'invented-instance';
    },
    (s) => {
      getCheckpoint(s).confirmed = true;
    },
    (s) => {
      getCheckpoint(s).observations.push(
        structuredClone(getCheckpoint(s).observations[0]),
      );
    },
  ];
  for (const edit of edits) {
    const payload = JSON.parse(before);
    edit(payload.state);
    await assert.rejects(controller.import(JSON.stringify(payload)));
    assert.equal(await controller.export(), before);
    assert.equal(store.writes, writes);
  }
});
await test('entry-only public commands cannot mutate a parked onboarding flow from the catalog', async () => {
  const { controller, store } = await setup();
  await ready(controller);
  await controller.deferSetup();
  const before = controller.snapshot(),
    writes = store.writes;
  for (const operation of [
    () => controller.continueQuestionnaire(),
    () => controller.saveAccess(answers(controller)),
    () => controller.startEntryCheck(),
  ]) {
    await assert.rejects(operation());
    assert.deepEqual(controller.snapshot(), before);
    assert.equal(store.writes, writes);
  }
});
await test('retest after provisional practice keeps the deferred group and excludes a target prompted this visit', async () => {
  const { controller } = await setup();
  await ready(controller, { companionAvailable: false });
  const oldCheckpoint = checkpoint(controller).id;
  await controller.startEntryPractice();
  let promptedItem;
  for (let index = 0; index < 3; index++) {
    await controller.launch(
      await controller.planNext(),
      'retest-practice-' + index,
    );
    if (index === 0) {
      promptedItem = controller.snapshot().profile.activeInstance.itemId;
      await controller.help({ level: 1 });
    }
    await controller.answer({
      instanceId: 'retest-practice-' + index,
      disposition: 'skipped',
    });
  }
  await controller.finishEntryPractice();
  await controller.saveQuestionnaire(
    answers(controller, { companionAvailable: true, reads: ['texts'] }),
    null,
  );
  await controller.retestEntry();
  assert.notEqual(checkpoint(controller).id, oldCheckpoint);
  assert.equal(checkpoint(controller).groupId, 'CVC');
  assert.equal(controller.snapshot().onboarding.rootGoalGroup, 'CVC');
  assert.deepEqual(checkpoint(controller).observations, []);
  await controller.launch(
    await controller.planNext(),
    'retest-unprompted',
    true,
  );
  assert.notEqual(
    controller.snapshot().profile.activeInstance.itemId,
    promptedItem,
  );
  assert.deepEqual(controller.snapshot().profile.confirmedSkills, []);
});
await test('deferring an active probe saves skipped observation and deferred report atomically', async () => {
  const { controller, store } = await setup();
  await ready(controller);
  await controller.launch(await controller.planNext(), 'active-defer', true);
  const before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(controller.deferEntryCheck(), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
  store.rejectCommit = false;
  await controller.deferEntryCheck();
  const state = controller.snapshot();
  assert.equal(state.profile.activeInstance, null);
  assert.equal(state.profile.receipts['active-defer'].outcome, 'skipped');
  assert.equal(checkpoint(controller).observations[0].result, 'unassessed');
  assert.equal(checkpoint(controller).observations[0].reason, 'skipped');
  assert.equal(state.onboarding.entry.placement.reason, 'ENTRY_DEFERRED');
  assert.ok(state.onboarding.deferredGroups.includes('CVC'));
  assert.notEqual((await controller.planNext()).kind, 'entry_task');
});

await test('budget report resumes the same checkpoint and preserves prior successes across visits', async () => {
  const { controller, store } = await setup();
  await ready(controller, { budget: 3 });
  await probe(controller, 'budget-success');
  for (const [id, disposition] of [
    ['budget-uncertain', 'uncertain'],
    ['budget-skipped', 'skipped'],
  ]) {
    await controller.launch(await controller.planNext(), id, true);
    await controller.answer({ instanceId: id, disposition });
  }
  assert.equal((await controller.planNext()).kind, 'pause');
  const cp = structuredClone(checkpoint(controller));
  await controller.pauseEntryReport();
  assert.equal(
    controller.snapshot().onboarding.entry.resumeCheckpointId,
    cp.id,
  );
  const reloaded = await CurriculumController.open(supply, store, legacy);
  await reloaded.endVisit();
  await reloaded.beginVisit('budget-resume-visit', 3);
  await reloaded.retestEntry();
  assert.equal(checkpoint(reloaded).id, cp.id);
  assert.deepEqual(checkpoint(reloaded).metadata, cp.metadata);
  assert.deepEqual(checkpoint(reloaded).observations, cp.observations);
  assert.equal(reloaded.snapshot().onboarding.entry.checkpoints.length, 1);
  await probe(reloaded, 'budget-second-success');
  await reloaded.finishEntryGroup(true);
  assert.ok(reloaded.snapshot().profile.confirmedSkills.includes('decode.cvc'));
});

await test('side checks retain the root goal and allow only one insertion per visit', async () => {
  const { controller } = await setup();
  await ready(controller, { reads: ['letters'], letterPairs: ['MS', 'LP'] });
  await probe(controller, 'main-cv-1');
  await probe(controller, 'main-cv-2');
  await controller.finishEntryGroup(true);
  const rootGoal = controller.snapshot().onboarding.rootGoalGroup;
  await controller.requestSideCheck();
  assert.equal(checkpoint(controller).groupId, 'LP_SIGN');
  for (let index = 0; index < 4; index++) {
    const plan = await controller.planNext();
    if (plan.kind === 'entry_group_result') break;
    assert.equal(plan.kind, 'entry_task');
    await controller.launch(plan, 'side-sign-' + index, true);
    const task =
      curriculum.items[controller.snapshot().profile.activeInstance.itemId];
    await controller.answer({
      instanceId: 'side-sign-' + index,
      response: { optionIds: task.answer.correctOptionIds },
    });
  }
  await controller.finishEntryGroup(true);
  assert.equal(controller.snapshot().onboarding.rootGoalGroup, rootGoal);
  assert.deepEqual(controller.snapshot().onboarding.sideQueue, [
    'LP_CV',
    'MS_SIGN',
  ]);
  await assert.rejects(
    controller.requestSideCheck(),
    /SIDE_CHECK_NOT_AVAILABLE/,
  );
  await controller.endVisit();
  await controller.beginVisit('next-side-visit', 7);
  await controller.requestSideCheck();
  assert.equal(checkpoint(controller).groupId, 'LP_CV');
  assert.equal(controller.snapshot().onboarding.rootGoalGroup, rootGoal);
  await probe(controller, 'side-cv-1');
  await probe(controller, 'side-cv-2');
  await controller.finishEntryGroup(true);
  assert.equal(controller.snapshot().onboarding.rootGoalGroup, rootGoal);
  await assert.rejects(
    controller.requestSideCheck(),
    /SIDE_CHECK_NOT_AVAILABLE/,
  );
});
console.log('Curriculum onboarding: ' + passed + ' scenarios passed');
