import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { RevisionConflict } = await mod('lib/progress/indexed-db.js');
const supply = await loadSupply(...supplyText());
const curriculum = supply.curriculum;
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
  const controller = await CurriculumController.open(supply, store, legacy);
  return { controller, store };
}
const episode = (method) =>
  curriculum.episodes[curriculum.methodComparison[method].episodeId];
function syntheticResponse(task) {
  switch (task.answer.kind) {
    case 'companion_reading':
      return { reading: { verifier: 'companion', correct: true } };
    case 'ordered_parts':
      return { tokenIds: task.partTokens.map((token) => token.tokenId) };
    case 'spans':
      return { segments: structuredClone(task.answer.segments) };
    case 'exact':
      return { text: task.answer.value };
    default:
      throw new Error(
        'Unexpected demonstration answer kind: ' + task.answer.kind,
      );
  }
}
async function completeVisible(controller) {
  const visible = controller.visible();
  if (visible.kind === 'info') await controller.acknowledge(visible.planId);
  else {
    const instance = controller.snapshot().profile.activeInstance;
    await controller.answer({
      instanceId: instance.instanceId,
      response: syntheticResponse(curriculum.items[instance.itemId]),
    });
  }
}
async function step(controller, id) {
  await controller.launch(await controller.planNext(), id);
  await completeVisible(controller);
}
let passed = 0;
async function test(name, fn) {
  await fn();
  console.log('PASS ' + name);
  passed++;
}

for (const method of ['p1', 'p2']) {
  await test(
    method +
      ' demonstration follows every authored step with exposure but no course mastery',
    async () => {
      const { controller, store } = await setup();
      const original = controller.snapshot().profile;
      await controller.selectDemonstration(method);
      await controller.beginVisit('demo-' + method, 7);
      const seen = [];
      for (const authored of episode(method).steps) {
        const token = await controller.planNext();
        assert.equal(
          token.kind,
          authored.action === 'task'
            ? 'demonstration_task'
            : 'demonstration_info',
        );
        await controller.launch(token, 'demo-' + authored.id);
        const visible = controller.visible();
        assert.equal(visible.instruction, authored.instruction);
        if (visible.kind === 'task') {
          const active = controller.snapshot().profile.activeInstance;
          assert.equal(active.context, 'demo');
          assert.equal(active.phase, 'demo');
          assert.equal(active.nodeId, null);
          assert.equal(active.programId, null);
          assert.equal(active.episodeId, episode(method).id);
          assert.equal(active.stepId, authored.id);
          assert.equal(active.itemId, authored.itemId);
          assert.equal(active.mode, authored.mode);
        } else if (authored.spokenText) {
          assert.equal(
            await controller.informationAudio(),
            authored.spokenText,
          );
        }
        seen.push(authored.id);
        await completeVisible(controller);
      }
      const state = controller.snapshot();
      assert.equal(
        state.demonstrationRuns[method].position,
        episode(method).steps.length,
      );
      assert.equal(
        (await controller.planNext()).kind,
        'demonstration_complete',
      );
      assert.deepEqual(
        seen,
        episode(method).steps.map((entry) => entry.id),
      );
      assert.deepEqual(state.profile.programs, original.programs);
      assert.deepEqual(state.profile.confirmedSkills, []);
      assert.deepEqual(state.profile.skillBasis, {});
      assert.deepEqual(state.profile.reviewQueue, []);
      assert.deepEqual(state.profile.knownLetters, []);
      assert.ok(state.profile.exposures.words.includes('ЛУПА'));
      assert.ok(state.profile.attempts.length > 0);
      assert.ok(
        state.profile.attempts.every(
          (entry) =>
            entry.context === 'demo' &&
            entry.phase === 'demo' &&
            entry.decodingTransfer === false,
        ),
      );
      assert.equal(
        state.profile.currentVisit.actions,
        episode(method).steps.length,
      );
      await controller.saveDemoComfort('comfortable');
      const reloaded = await CurriculumController.open(supply, store, legacy);
      assert.equal(
        reloaded.snapshot().demonstrationRuns[method].comfort,
        'comfortable',
      );
      assert.equal((await reloaded.planNext()).kind, 'demonstration_complete');
    },
  );
}

await test('budget and reload preserve active demo instance; repeated answers do not advance twice', async () => {
  const { controller, store } = await setup();
  await controller.selectDemonstration('p1');
  await controller.beginVisit('budget-demo', 3);
  await step(controller, 'first-info');
  await step(controller, 'second-info');
  await controller.launch(await controller.planNext(), 'budget-compose');
  const visible = controller.visible();
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.visible(), visible);
  const activePlan = await reloaded.planNext();
  await reloaded.launch(activePlan);
  assert.deepEqual(reloaded.visible(), visible);
  const task =
    curriculum.items[reloaded.snapshot().profile.activeInstance.itemId];
  const answer = {
    instanceId: 'budget-compose',
    response: syntheticResponse(task),
  };
  await reloaded.answer(answer);
  const after = reloaded.snapshot();
  await reloaded.answer(answer);
  assert.deepEqual(reloaded.snapshot(), after);
  assert.equal(after.demonstrationRuns.p1.position, 3);
  assert.equal((await reloaded.planNext()).kind, 'pause');
  await reloaded.endVisit();
  await reloaded.beginVisit('next-demo-visit', 3);
  await reloaded.launch(await reloaded.planNext(), 'continued-read');
  assert.equal(
    reloaded.snapshot().profile.activeInstance.stepId,
    episode('p1').steps[3].id,
  );
});

await test('switching demonstrations restores the same task and informational screen', async () => {
  const { controller, store } = await setup();
  await controller.selectDemonstration('p1');
  await controller.beginVisit('switch-demo', 7);
  await step(controller, 'p1-info-1');
  await step(controller, 'p1-info-2');
  await controller.launch(await controller.planNext(), 'p1-compose');
  await controller.help({ level: 1 });
  const p1 = controller.visible();
  await controller.selectDemonstration('p2');
  await controller.launch(await controller.planNext());
  const p2 = controller.visible();
  await controller.selectDemonstration('p1');
  assert.deepEqual(controller.visible(), p1);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.visible(), p1);
  await reloaded.selectDemonstration('p2');
  assert.deepEqual(reloaded.visible(), p2);
  assert.equal(reloaded.snapshot().profile.currentVisit.actions, 4);
});

for (const taskActive of [false, true]) {
  await test(
    'demonstration preserves parked official ' +
      (taskActive ? 'instance' : 'information'),
    async () => {
      const { controller, store } = await setup();
      const program = curriculum.programs[0].id;
      await controller.selectProgram(program);
      await controller.beginVisit('official-demo', 7);
      await controller.launch(await controller.planNext(), 'official-start');
      if (taskActive) {
        await completeVisible(controller);
        await controller.launch(await controller.planNext());
        await completeVisible(controller);
        await controller.launch(
          await controller.planNext(),
          'official-compose',
        );
      }
      const saved = controller.visible();
      const position = structuredClone(
        controller.snapshot().profile.programs[program],
      );
      await controller.selectDemonstration('p1');
      await step(controller, 'demo-info-1');
      await step(controller, 'demo-info-2');
      await step(controller, 'demo-compose');
      const reloaded = await CurriculumController.open(supply, store, legacy);
      await reloaded.selectProgram(program);
      assert.deepEqual(reloaded.visible(), saved);
      assert.deepEqual(reloaded.snapshot().profile.programs[program], position);
    },
  );
}

await test('failed demo launch commits nothing and a saved change invalidates the old plan', async () => {
  const { controller, store } = await setup();
  await controller.selectDemonstration('p1');
  await controller.beginVisit('failed-demo', 3);
  const plan = await controller.planNext();
  const before = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(controller.launch(plan), /TEST_STORAGE_FAILURE/);
  assert.deepEqual(controller.snapshot(), before);
  assert.deepEqual(await store.read(), before);
  assert.equal(controller.visible(), null);
  store.rejectCommit = false;
  await controller.saveQuestionnaire(
    controller.snapshot().onboarding.questionnaire,
    null,
  );
  await assert.rejects(controller.launch(plan), /STALE_PLAN/);
  await controller.launch(await controller.planNext());
  const info = controller.visible();
  const shown = controller.snapshot();
  store.rejectCommit = true;
  await assert.rejects(
    controller.acknowledge(info.planId),
    /TEST_STORAGE_FAILURE/,
  );
  assert.deepEqual(controller.snapshot(), shown);
});

for (const suspended of [false, true]) {
  await test(
    'demo import rejects inconsistent ' +
      (suspended ? 'suspended' : 'active') +
      ' source metadata before writing',
    async () => {
      const { controller, store } = await setup();
      await controller.selectDemonstration('p1');
      await controller.beginVisit('import-demo', 7);
      await step(controller, 'import-info-1');
      await step(controller, 'import-info-2');
      await controller.launch(await controller.planNext(), 'import-compose');
      if (suspended) await controller.selectDemonstration('p2');
      const before = await controller.export();
      const writes = store.writes;
      const getInstance = (state) =>
        suspended
          ? state.demonstrationRuns.p1.suspendedInstance
          : state.profile.activeInstance;
      const edits = [
        (state) => {
          state.demonstrationRuns.p1.position++;
        },
        (state) => {
          getInstance(state).phase = 'guided';
        },
        (state) => {
          getInstance(state).mode = 'shared';
        },
        (state) => {
          getInstance(state).programId = curriculum.programs[0].id;
        },
        (state) => {
          getInstance(state).episodeId = episode('p2').id;
        },
        (state) => {
          const event = state.sourceEvents.find(
            (entry) =>
              entry.kind === 'launch' && entry.instanceId === 'import-compose',
          );
          event.demoStepId = episode('p1').steps[3].id;
        },
        (state) => {
          state.demonstrationRuns.p1.comfort = 'mastered';
        },
      ];
      for (const edit of edits) {
        const payload = JSON.parse(before);
        edit(payload.state);
        await assert.rejects(controller.import(JSON.stringify(payload)));
        assert.equal(await controller.export(), before);
        assert.equal(store.writes, writes);
      }
    },
  );
}
await test('demo import cannot claim completion without any presented or answered steps', async () => {
  const { controller, store } = await setup();
  await controller.selectDemonstration('p1');
  const before = await controller.export();
  const writes = store.writes;
  const payload = JSON.parse(before);
  payload.state.demonstrationRuns.p1.position = episode('p1').steps.length;
  await assert.rejects(controller.import(JSON.stringify(payload)));
  assert.equal(await controller.export(), before);
  assert.equal(store.writes, writes);
});
for (const parked of [false, true]) {
  await test(
    'demo info import rejects a changed ' +
      (parked ? 'parked' : 'active') +
      ' plan token',
    async () => {
      const { controller, store } = await setup();
      await controller.selectDemonstration('p1');
      await controller.beginVisit('info-token', 3);
      await controller.launch(await controller.planNext());
      const info = controller.visible();
      if (parked) await controller.selectDemonstration('p2');
      const before = await controller.export();
      const writes = store.writes;
      const payload = JSON.parse(before);
      payload.state.demonstrationRuns.p1.activeInfo = info.planId + '-changed';
      await assert.rejects(
        controller.import(JSON.stringify(payload)),
        /demo information origin/,
      );
      assert.equal(await controller.export(), before);
      assert.equal(store.writes, writes);
    },
  );
}
console.log('Curriculum demonstrations: ' + passed + ' scenarios passed');
