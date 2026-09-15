import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { engine } = await mod('lib/curriculum/core.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { roadmapPresentation } = await mod('features/roadmap/presentation.js');
const supply = await loadSupply(...supplyText());
const store = {
  async read() {
    return null;
  },
  async commit(next) {
    return { ...next, storageRevision: 0 };
  },
};
const controller = await CurriculumController.open(supply, store, {
  getItem() {
    return null;
  },
});
const state = controller.snapshot();
const program = supply.curriculum.programs[0];
state.profile = engine.switchProgram(
  state.profile,
  program.id,
  supply.curriculum,
);
let passed = 0;
function test(name, fn) {
  fn();
  console.log('PASS ' + name);
  passed++;
}

test('roadmap is read-only, preserves both positions and limits authored goals to three', () => {
  const snapshot = structuredClone(state);
  const view = roadmapPresentation(supply, state);
  assert.deepEqual(state, snapshot);
  assert.deepEqual(
    view.goals.map((goal) => goal.id),
    program.defaultPath.slice(0, 3),
  );
  assert.ok(view.goals.length <= 3);
  assert.ok(view.goals.every((goal) => goal.status === 'learning'));
});
test('entry confirmation stays separate from mastery and does not complete a node', () => {
  const next = structuredClone(state);
  const node = supply.curriculum.nodes[program.defaultPath[0]];
  next.profile.skillBasis[node.skillId] = {
    status: 'confirmed_entry',
    source: 'explicit_entry_checkpoint',
  };
  next.profile.confirmedSkills.push(node.skillId);
  const view = roadmapPresentation(supply, next);
  assert.equal(view.confirmedEntry[0].id, node.skillId);
  assert.equal(view.goals[0].status, 'learning');
  assert.equal(
    view.evidence.filter((item) => item.status === 'mastered').length,
    0,
  );
});
test('program switch displays its own authored position without changing the other one', () => {
  const next = structuredClone(state),
    other = supply.curriculum.programs[1];
  next.profile.programs[program.id].cursor = 2;
  next.profile.programs[program.id].nodeId = program.defaultPath[2];
  next.profile = engine.switchProgram(
    next.profile,
    other.id,
    supply.curriculum,
  );
  const snapshot = structuredClone(next.profile.programs);
  assert.equal(
    roadmapPresentation(supply, next).goals[0].id,
    other.defaultPath[0],
  );
  assert.deepEqual(next.profile.programs, snapshot);
});
test('finished position has no invented goals or inferred mastery', () => {
  const next = structuredClone(state);
  next.profile.programs[program.id].nodeId = null;
  next.profile.programs[program.id].cursor = program.defaultPath.length;
  const view = roadmapPresentation(supply, next);
  assert.deepEqual(view.goals, []);
  assert.ok(view.evidence.every((item) => item.status === 'learning'));
});
test('interest choices come only from supplied material tags', () => {
  const actual = [
    ...new Set(
      Object.values(supply.curriculum.items).flatMap(
        (item) => item.interestTags,
      ),
    ),
  ].sort();
  assert.deepEqual(roadmapPresentation(supply, state).tags, actual);
});
test('assisted and unassessed entry observations remain distinct, with no mastery', () => {
  const next = structuredClone(state);
  next.onboarding.entry = {
    checkpoints: [
      {
        observations: [
          { result: 'assisted' },
          { result: 'unassessed' },
          { result: 'unassessed' },
        ],
      },
    ],
  };
  const view = roadmapPresentation(supply, next);
  assert.equal(view.entryAssisted, 1);
  assert.equal(view.entryUnassessed, 2);
  assert.ok(view.evidence.every((item) => item.status === 'learning'));
});
console.log(`Curriculum roadmap: ${passed} passed`);
