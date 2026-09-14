import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { createState, encodeProgress, decodeProgress } = await mod(
  'lib/progress/state.js',
);
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { RevisionConflict } = await mod('lib/progress/indexed-db.js');
const engine = await mod('lib/curriculum/vendor/source/engine.mjs');
const source = supplyText(),
  supply = await loadSupply(...source),
  c = supply.curriculum;
const P1 = c.programs[0].id,
  P2 = c.programs[1].id;
const legacyValues = {
  'reading-profile-v1': '{"name":"тест","age":"8","start":"words"}',
  'reading-steps-v3':
    '{"stars":73,"settings":{"sound":false},"history":[{"old":true}]}',
  'reading-text-options-v1': '{"mode":"listen","ask":false}',
};
const legacy = { getItem: (key) => legacyValues[key] ?? null };
class Store {
  state = null;
  backups = [];
  fail = false;
  gate = null;
  async read() {
    return structuredClone(this.state);
  }
  async commit(next, expected, backup = false) {
    validateState(next, supply);
    if (this.gate) await this.gate;
    if (this.fail) throw new Error('QUOTA_TEST');
    if ((this.state?.storageRevision ?? null) !== expected)
      throw new RevisionConflict();
    if (backup && this.state) this.backups.push(structuredClone(this.state));
    this.state = structuredClone({
      ...next,
      storageRevision: (this.state?.storageRevision ?? -1) + 1,
    });
    return this.read();
  }
}
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
async function setup() {
  const store = new Store();
  const ctl = await CurriculumController.open(supply, store, legacy);
  return { store, ctl };
}
function preparedState() {
  const s = createState(supply, legacy, 'synthetic-test-only');
  s.profile.knownLetters = [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
  for (const p of c.programs)
    for (const skillId of c.nodes[p.defaultPath[0]].prerequisiteSkills)
      s.profile = engine.confirmEntrySkill(s.profile, c, skillId, {
        verifier: 'companion',
        reason: 'SYNTHETIC TEST FIXTURE',
      });
  return s;
}
async function prepared() {
  const store = new Store();
  await store.commit(preparedState(), null);
  return { store, ctl: await CurriculumController.open(supply, store, legacy) };
}
await test('both manifests, original legacy strings and no inferred skills', async () => {
  const { ctl } = await setup(),
    s = ctl.snapshot();
  assert.equal(c.programs.length, 2);
  assert.deepEqual(s.legacy.values, legacyValues);
  assert.equal(s.profile.currentProgramId, null);
  assert.equal(s.route, null);
  assert.deepEqual(s.profile.confirmedSkills, []);
  assert.deepEqual(s.profile.attempts, []);
  assert.equal(Object.keys(s.profile.programs).length, 2);
  assert.deepEqual(s.profile.knownLetters, []);
});
await test('hash mismatch rejected before parsing', async () => {
  await assert.rejects(loadSupply(source[0] + ' ', source[1]), /SHA256/);
});
await test('blocked old storage stops migration', async () => {
  const store = new Store();
  await assert.rejects(
    CurriculumController.open(supply, store, {
      getItem() {
        throw new Error('OLD_STORAGE_BLOCKED');
      },
    }),
    /OLD_STORAGE/,
  );
  assert.equal(store.state, null);
});
await test('defer -> reload -> catalog; questionnaire preserved; planner not called', async () => {
  const store = new Store(),
    explode = {
      source: 'recommended',
      select() {
        throw new Error('SHOULD_NOT_PLAN');
      },
    };
  let ctl = await CurriculumController.open(supply, store, legacy, {
    recommended: explode,
    custom: explode,
  });
  const q = ctl.snapshot().onboarding.questionnaire;
  q.reads = ['short_words'];
  await ctl.saveQuestionnaire(q, 'reads');
  assert.deepEqual(await ctl.deferSetup(), { screen: 'catalog' });
  ctl = await CurriculumController.open(supply, store, legacy, {
    recommended: explode,
    custom: explode,
  });
  assert.equal((await ctl.planNext()).kind, 'catalog');
  assert.equal(ctl.snapshot().profile.currentVisit, null);
  await ctl.resumeSetup();
  assert.deepEqual(ctl.snapshot().onboarding.questionnaire.reads, [
    'short_words',
  ]);
  assert.equal(ctl.snapshot().profile.currentProgramId, null);
});
await test('two controller revisions cannot overwrite a newer state', async () => {
  const { store, ctl } = await setup(),
    other = await CurriculumController.open(supply, store, legacy);
  await ctl.deferSetup();
  await assert.rejects(other.resumeSetup(), RevisionConflict);
  assert.equal(store.state.onboarding.setupStatus, 'deferred');
  await other.refresh();
  await other.resumeSetup();
  assert.equal(store.state.onboarding.setupStatus, 'in_progress');
});
await test('invalid imports leave state unchanged; valid import backs up current revision', async () => {
  const { store, ctl } = await setup(),
    original = await ctl.export();
  for (const raw of ['{', '{}', original.replace('"version":2', '"version":9')])
    await assert.rejects(ctl.import(raw));
  assert.equal(await ctl.export(), original);
  await ctl.deferSetup();
  const previous = ctl.snapshot();
  await ctl.import(original);
  assert.deepEqual(store.backups[0], previous);
  assert.ok(ctl.snapshot().storageRevision > previous.storageRevision);
});
await test('hostile nested imports rejected', async () => {
  const base = createState(supply, legacy);
  const edits = [
    (s) => (s.profile.availableCapabilities = ['toString']),
    (s) => (s.profile.confirmedSkills = ['constructor']),
    (s) => {
      s.profile.currentProgramId = P1;
      delete s.profile.programs[P1];
    },
    (s) => (s.profile.skillBasis['decode.cv_cv'] = { status: 'mastered' }),
    (s) => (s.profile.reviewQueue = [null]),
    (s) => (s.profile.receipts.fake = { outcome: 'correct' }),
    (s) =>
      (s.profile.currentVisit = {
        id: 'bad',
        index: -1,
        actions: -1,
        budget: -1,
        checkedNodes: [],
      }),
    (s) =>
      (s.profile.exposures.events = [
        {
          visitId: 'x',
          texts: [{}],
          promptedTexts: [],
          heardPassages: [],
          itemIds: [],
        },
      ]),
    (s) =>
      (s.profile.programs[P1].suspendedInstance = { instanceId: 'broken' }),
    (s) => (s.profile.programs[P1].episodeIndex = 999999),
    (s) => (s.onboarding.currentCheckpointGroup = 'FACT3'),
    (s) => (s.onboarding.questionnaire.reads = ['invented']),
    (s) => {
      s.studyMode = 'recommended';
      s.route = { source: 'recommended', routeId: P1, version: 1 };
      s.profile.currentProgramId = P2;
    },
  ];
  for (const edit of edits) {
    const s = structuredClone(base);
    edit(s);
    assert.throws(() => validateState(s, supply));
  }
});
await test('plan and launch save separately; target unavailable until commit; stale plan rejected', async () => {
  const { store, ctl } = await prepared();
  await ctl.selectProgram(P1);
  await ctl.beginVisit('plan', 7);
  const plan = await ctl.planNext();
  assert.ok(plan.planId);
  assert.equal(ctl.visible(), null);
  let release;
  store.gate = new Promise((r) => (release = r));
  const launching = ctl.launch(plan, 'first-info');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(ctl.visible(), null);
  release();
  store.gate = null;
  const visible = await launching;
  assert.equal(visible.kind, 'info');
  assert.ok(store.state.profile.programs[P1].activeInfo);
  await assert.rejects(ctl.launch(plan), /STALE_PLAN/);
});
await test('failed commit never exposes target or advances local revision', async () => {
  const { store, ctl } = await prepared();
  await ctl.selectProgram(P1);
  await ctl.beginVisit('failed', 7);
  const plan = await ctl.planNext(),
    before = ctl.snapshot();
  store.fail = true;
  await assert.rejects(ctl.launch(plan), /QUOTA_TEST/);
  assert.deepEqual(ctl.snapshot(), before);
  assert.equal(ctl.visible(), null);
});
await test('both program info positions survive switching; custom cannot acknowledge official info', async () => {
  const { ctl } = await prepared();
  await ctl.selectProgram(P1);
  await ctl.beginVisit('both', 7);
  await ctl.launch(await ctl.planNext());
  const p1 = structuredClone(ctl.snapshot().profile.programs[P1]),
    info = ctl.visible();
  await ctl.selectProgram(P2);
  await ctl.launch(await ctl.planNext());
  const p2 = structuredClone(ctl.snapshot().profile.programs[P2]);
  await ctl.selectProgram(P1);
  assert.deepEqual(ctl.snapshot().profile.programs[P1], p1);
  assert.deepEqual(ctl.snapshot().profile.programs[P2], p2);
  await ctl.registerCustomRoute({
    source: 'custom',
    routeId: 'test-custom',
    version: 1,
    steps: [],
    position: 0,
    suspendedInstance: null,
  });
  await ctl.selectCustomRoute('test-custom');
  assert.equal(ctl.visible(), null);
  await assert.rejects(ctl.acknowledge(info.planId), /NOT_RECOMMENDED/);
});
const passage = Object.values(c.items).find(
  (t) =>
    t.kind === 'passage' &&
    t.answer.questions.length >= 2 &&
    t.id !== 'task.1bb67acaeb41',
);
await test('passage stages, partial, option order, reload and duplicate submission', async () => {
  const { store, ctl } = await setup();
  await ctl.beginVisit('partial', 3);
  await ctl.launchFree(passage.id, 'read', 'passage');
  await assert.rejects(ctl.revealOptions(), /READING_STAGE/);
  await ctl.recordReading('passage', { verifier: 'companion', correct: true });
  const shown = await ctl.revealOptions();
  assert.equal(shown.questions.length, passage.answer.questions.length);
  assert.equal('answer' in shown, false);
  assert.equal('correctOptionIds' in shown.questions[0], false);
  const [first, ...rest] = passage.answer.questions;
  await ctl.answer({
    instanceId: 'passage',
    response: { answers: { [first.id]: first.correctOptionIds } },
  });
  const saved = ctl.snapshot();
  assert.ok(saved.profile.activeInstance.lastPartial);
  assert.equal(saved.profile.attempts.length, 0);
  const reloaded = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reloaded.snapshot(), saved);
  assert.deepEqual(reloaded.visible().questions, shown.questions);
  await reloaded.answer({
    instanceId: 'passage',
    response: {
      answers: Object.fromEntries(rest.map((q) => [q.id, q.correctOptionIds])),
    },
  });
  const complete = reloaded.snapshot();
  assert.equal(complete.profile.attempts.length, 1);
  await reloaded.answer({ instanceId: 'passage', response: {} });
  assert.deepEqual(reloaded.snapshot(), complete);
});
await test('target help saved before reveal, zero access help does not prompt', async () => {
  const { ctl } = await setup();
  await ctl.beginVisit('help', 3);
  await ctl.launchFree(passage.id, 'read', 'help-task');
  await ctl.help({ level: 0 });
  assert.equal(
    engine.wasTargetPromptedThisVisit(
      ctl.snapshot().profile,
      passage.learnerText,
    ),
    false,
  );
  await ctl.help({ level: 1 });
  assert.equal(
    engine.wasTargetPromptedThisVisit(
      ctl.snapshot().profile,
      passage.learnerText,
    ),
    true,
  );
  const before = ctl.snapshot();
  await assert.rejects(
    ctl.recordReading('help-task', { verifier: 'ASR', correct: true }),
    /READING_PROOF/,
  );
  assert.deepEqual(ctl.snapshot(), before);
});
await test('restore final budget action without beginning a new visit', async () => {
  const { ctl } = await setup();
  await ctl.beginVisit('budget', 3);
  for (let i = 0; i < 2; i++) {
    await ctl.launchFree(passage.id, 'read', 'skip-' + i);
    await ctl.answer({ instanceId: 'skip-' + i, disposition: 'skipped' });
  }
  await ctl.launchFree(passage.id, 'read', 'last');
  await ctl.deferSetup();
  await ctl.launchFree(passage.id, 'read', 'ignored');
  assert.equal(ctl.snapshot().profile.activeInstance.instanceId, 'last');
  assert.equal(ctl.snapshot().profile.currentVisit.actions, 3);
});
await test('custom uses common executor/storage and does not advance official nodes', async () => {
  const { ctl } = await prepared();
  const before = structuredClone(ctl.snapshot().profile.programs);
  const task = Object.values(c.items).find(
    (t) => t.kind === 'read' && t.allowedModes.includes('read'),
  );
  await ctl.registerCustomRoute({
    source: 'custom',
    routeId: 'sequence-test',
    version: 1,
    steps: [{ id: 'custom-step-1', itemId: task.id, mode: 'read' }],
    position: 0,
    suspendedInstance: null,
  });
  await ctl.selectCustomRoute('sequence-test');
  await ctl.beginVisit('custom', 3);
  await ctl.launch(await ctl.planNext(), 'custom-instance');
  await ctl.answer({
    instanceId: 'custom-instance',
    response: { reading: { verifier: 'companion', correct: true } },
  });
  assert.deepEqual(ctl.snapshot().profile.programs, before);
  assert.equal(ctl.snapshot().customRoutes['sequence-test'].position, 1);
  assert.equal((await ctl.planNext()).kind, 'custom_complete');
  assert.equal(ctl.snapshot().profile.attempts[0].context, 'free');
  assert.equal(ctl.snapshot().sourceEvents.at(-1).source, 'custom');
});
await test('raw answers cannot bypass reading/reveal stages', async () => {
  const { ctl } = await setup();
  const task = Object.values(c.items).find((t) => t.kind === 'read_meaning');
  await ctl.beginVisit('stages', 3);
  await ctl.launchFree(task.id, 'read', 'stage-task');
  const before = ctl.snapshot();
  await assert.rejects(
    ctl.answer({
      instanceId: 'stage-task',
      response: {
        optionIds: task.answer.correctOptionIds,
        reading: { verifier: 'companion', correct: true },
      },
    }),
    /STAGES_REQUIRED/,
  );
  assert.deepEqual(ctl.snapshot(), before);
  await ctl.recordReading('stage-task', {
    verifier: 'companion',
    correct: true,
  });
  await assert.rejects(
    ctl.answer({
      instanceId: 'stage-task',
      response: { optionIds: task.answer.correctOptionIds },
    }),
    /STAGES_REQUIRED/,
  );
  await ctl.revealOptions();
  await ctl.answer({
    instanceId: 'stage-task',
    response: { optionIds: task.answer.correctOptionIds },
  });
  assert.equal(
    ctl.snapshot().profile.receipts['stage-task'].outcome,
    'correct',
  );
});
await test('parked official task survives a completed free task and reload', async () => {
  const { ctl, store } = await prepared();
  await ctl.selectProgram(P1);
  await ctl.beginVisit('parked', 7);
  for (let i = 0; i < 7 && !ctl.snapshot().profile.activeInstance; i++) {
    await ctl.launch(await ctl.planNext());
    if (ctl.visible()?.kind === 'info')
      await ctl.acknowledge(ctl.visible().planId);
  }
  const active = structuredClone(ctl.snapshot().profile.activeInstance);
  assert.ok(active);
  await ctl.deferSetup();
  await ctl.launchFree(passage.id, 'read', 'unrelated-free');
  await ctl.answer({ instanceId: 'unrelated-free', disposition: 'skipped' });
  const reloaded = await CurriculumController.open(supply, store, legacy);
  await reloaded.selectProgram(P1);
  assert.deepEqual(reloaded.snapshot().profile.activeInstance, active);
  const ep = c.episodes[active.episodeId],
    step = ep.steps.find((x) => x.id === active.stepId);
  assert.equal(reloaded.visible().instruction, step.instruction);
});
await test('budgets 3/5/7 stop new screens and preserve unfinished tasks', async () => {
  for (const budget of [3, 5, 7]) {
    const { ctl } = await setup();
    await ctl.beginVisit('budget-' + budget, budget);
    for (let i = 0; i < budget; i++) {
      await ctl.launchFree(passage.id, 'read', 'b-' + i);
      await ctl.answer({ instanceId: 'b-' + i, disposition: 'skipped' });
    }
    await assert.rejects(
      ctl.launchFree(passage.id, 'read', 'extra'),
      /VISIT_OR_BUDGET/,
    );
    assert.equal(ctl.snapshot().profile.currentVisit.actions, budget);
  }
});

for (const suspended of [false, true]) {
  await test(
    'custom import rejects mismatched ' +
      (suspended ? 'suspended' : 'active') +
      ' source and step atomically',
    async () => {
      const { ctl, store } = await setup();
      const tasks = Object.values(c.items).filter(
        (t) =>
          t.kind === 'read' &&
          t.allowedModes.includes('read') &&
          t.allowedModes.includes('listen'),
      );
      await ctl.registerCustomRoute({
        source: 'custom',
        routeId: 'import-route',
        version: 1,
        steps: [{ id: 'first', itemId: tasks[0].id, mode: 'read' }],
        position: 0,
        suspendedInstance: null,
      });
      await ctl.selectCustomRoute('import-route');
      await ctl.beginVisit('import-custom', 3);
      await ctl.launch(await ctl.planNext(), 'custom-import-instance');
      if (suspended) await ctl.deferSetup();
      const before = await ctl.export(),
        saved = structuredClone(store.state),
        backups = store.backups.length;
      const edits = [
        (state) => {
          state.customRoutes['import-route'].steps[0].itemId = tasks[1].id;
        },
        (state) => {
          state.customRoutes['import-route'].steps[0].mode = 'listen';
        },
        (state) => {
          state.customRoutes['import-route'].position = 1;
        },
        (state) => {
          state.customRoutes['import-route'].version = 2;
          state.route.version = 2;
        },
        (state) => {
          const route = state.customRoutes['import-route'];
          delete state.customRoutes['import-route'];
          route.routeId = 'different-route';
          state.customRoutes['different-route'] = route;
          state.route.routeId = 'different-route';
        },
        (state) => {
          state.sourceEvents = state.sourceEvents.filter(
            (event) => event.kind !== 'launch',
          );
        },
        (state) => {
          const event = state.sourceEvents.find(
            (event) => event.kind === 'launch',
          );
          event.source = 'free';
          event.routeId = null;
          event.routeVersion = null;
        },
        (state) => {
          const instance = suspended
            ? state.customRoutes['import-route'].suspendedInstance
            : state.profile.activeInstance;
          instance.programId = P1;
        },
      ];
      for (const edit of edits) {
        const payload = JSON.parse(before);
        edit(payload.state);
        await assert.rejects(
          ctl.import(JSON.stringify(payload)),
          /custom instance|instance source|free instance|source event custom step/,
        );
        assert.equal(await ctl.export(), before);
        assert.deepEqual(store.state, saved);
        assert.equal(store.backups.length, backups);
      }
      const reloaded = await CurriculumController.open(supply, store, legacy);
      if (suspended) await reloaded.selectCustomRoute('import-route');
      assert.equal(reloaded.visible().instanceId, 'custom-import-instance');
      await reloaded.answer({
        instanceId: 'custom-import-instance',
        response: { reading: { verifier: 'companion', correct: true } },
      });
      assert.equal(
        reloaded.snapshot().customRoutes['import-route'].position,
        1,
      );
    },
  );
}

await test('old platform and export versions require migration without resetting state', async () => {
  const { ctl, store } = await setup();
  const before = await ctl.export(),
    saved = structuredClone(store.state);
  for (const mutate of [
    (payload) => {
      payload.version = 1;
    },
    (payload) => {
      payload.state.schemaVersion = 1;
    },
  ]) {
    const payload = JSON.parse(before);
    mutate(payload);
    await assert.rejects(
      ctl.import(JSON.stringify(payload)),
      /INCOMPATIBLE_IMPORT|platform version/,
    );
    assert.equal(await ctl.export(), before);
    assert.deepEqual(store.state, saved);
    assert.equal(store.backups.length, 0);
  }
  store.state.schemaVersion = 1;
  const old = structuredClone(store.state);
  await assert.rejects(
    CurriculumController.open(supply, store, legacy),
    /platform version/,
  );
  assert.deepEqual(store.state, old);
});
for (const suspended of [false, true]) {
  await test(
    'repeated custom material keeps exact ' +
      (suspended ? 'suspended' : 'active') +
      ' step identity',
    async () => {
      const { ctl, store } = await setup();
      const task = Object.values(c.items).find(
        (t) => t.kind === 'read' && t.allowedModes.includes('read'),
      );
      await ctl.registerCustomRoute({
        source: 'custom',
        routeId: 'repeat-route',
        version: 1,
        steps: [
          { id: 'first', itemId: task.id, mode: 'read' },
          { id: 'repeat', itemId: task.id, mode: 'read' },
        ],
        position: 0,
        suspendedInstance: null,
      });
      await ctl.selectCustomRoute('repeat-route');
      await ctl.beginVisit('repeat-visit', 3);
      await ctl.launch(await ctl.planNext(), 'first-attempt');
      if (suspended) await ctl.deferSetup();
      const before = await ctl.export(),
        saved = structuredClone(store.state),
        backups = store.backups.length;
      for (const mutate of [
        (state) => {
          state.customRoutes['repeat-route'].position = 1;
        },
        (state) => {
          state.sourceEvents.find(
            (event) => event.kind === 'launch',
          ).customStepId = 'repeat';
        },
        (state) => {
          state.sourceEvents.find(
            (event) => event.kind === 'launch',
          ).customStepId = null;
        },
        (state) => {
          delete state.sourceEvents.find((event) => event.kind === 'launch')
            .customStepId;
        },
      ]) {
        const payload = JSON.parse(before);
        mutate(payload.state);
        await assert.rejects(
          ctl.import(JSON.stringify(payload)),
          /instance source origin|source event custom step/,
        );
        assert.equal(await ctl.export(), before);
        assert.deepEqual(store.state, saved);
        assert.equal(store.backups.length, backups);
      }
      const reloaded = await CurriculumController.open(supply, store, legacy);
      if (suspended) await reloaded.selectCustomRoute('repeat-route');
      await reloaded.answer({
        instanceId: 'first-attempt',
        response: { reading: { verifier: 'companion', correct: true } },
      });
      assert.equal(
        reloaded.snapshot().customRoutes['repeat-route'].position,
        1,
      );
      await reloaded.launch(await reloaded.planNext(), 'repeat-attempt');
      assert.equal(reloaded.visible().instanceId, 'repeat-attempt');
      assert.deepEqual(
        reloaded
          .snapshot()
          .sourceEvents.filter((event) => event.kind === 'launch')
          .map((event) => event.customStepId),
        ['first', 'repeat'],
      );
      await reloaded.answer({
        instanceId: 'repeat-attempt',
        response: { reading: { verifier: 'companion', correct: true } },
      });
      assert.equal(
        reloaded.snapshot().customRoutes['repeat-route'].position,
        2,
      );
      assert.equal((await reloaded.planNext()).kind, 'custom_complete');
    },
  );
}
console.log('Curriculum foundation: ' + passed + ' scenarios passed');
