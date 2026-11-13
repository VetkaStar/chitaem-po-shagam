import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const out = compileCurriculum();
const mod = name => import(pathToFileURL(`${out}/${name}`));
const { profileAgeBand, ageVisitBudget, syncProfileAge } = await mod('lib/entry08/profile-age.js');
const { migrateAnswers } = await mod('lib/entry08/migration.js');
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const E = await mod('lib/entry08/vendor/lite-entry.mjs');
const P = await mod('lib/entry08/personal.js');
const { parseProfile } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(
  fs.readFileSync('features/portal/profile.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText).toString('base64'));
const supply = await loadSupply(...supplyText());
const bank = JSON.parse(fs.readFileSync('content/curriculum/lite-bank.json', 'utf8'));
const passed = [];
const test = async (name, fn) => { await fn(); passed.push(name); };
class Store {
  state = null;
  async read() { return structuredClone(this.state); }
  async commit(state, revision) {
    validateState(state, supply);
    assert.equal(revision, this.state?.storageRevision ?? null);
    this.state = structuredClone({ ...state, storageRevision: (revision ?? -1) + 1 });
    return this.read();
  }
}
const store = new Store();
let ctl = await CurriculumController.open(supply, store, { getItem: () => null });
const initial = ctl.snapshot();
await test('7/8/12/13+ boundaries and legacy 12+ remain distinct in profile and migration', () => {
  for (const [age, band] of [['7','under8'], ['8','8to12'], ['12','8to12'], ['13+','13plus'], ['12+','unknown']]) {
    assert.equal(profileAgeBand(age), band);
    assert.equal(migrateAnswers(initial, age).age, band);
    assert.equal(parseProfile(JSON.stringify({ name: 'Тест', age, start: 'syllables' })).age, age);
    assert.equal(ageVisitBudget(band), ['under8','unknown'].includes(band) ? 3 : 5);
  }
  const old = structuredClone(initial);
  old.onboarding.questionnaire.ageBand = 'under_6';
  assert.equal(migrateAnswers(old, '12').age, '8to12');
});
await test('Saved clarification survives legacy 12+ and unchanged main profile', () => {
  const ui = { version: '0.8.1', page: 'access', answers: { age: '13plus' } };
  assert.equal(syncProfileAge('12+', ui).ui.answers.age, '13plus');
  assert.equal(syncProfileAge('12+', { ...ui, answers: {} }).ui.answers.age, 'unknown');
  const known = syncProfileAge('8', { ...ui, answers: {} }).ui;
  assert.equal(syncProfileAge('8', { ...known, answers: { age: 'under8' } }).ui.answers.age, 'under8');
  assert.equal(syncProfileAge('13+', known).ui.answers.age, '13plus');
});
const entry = E.createEntry({ age: '8to12', reads: 'short_words', respondent: 'parent' }, 'age-test');
let personal = P.startPersonal(entry, bank, supply.curriculum, initial.profile);
const originalPersonal = structuredClone(personal);
const ui = { version: '0.8.1', profileAge: '8', answers: { age: '8to12', respondent: 'parent' }, page: 'lesson' };
await ctl.saveEntry08(initial.storageRevision, { entry, ui, personal });
await test('Profile edit persists through controller and reload without resetting active attempt or history', async () => {
  const before = ctl.snapshot();
  const update = syncProfileAge('7', before.profile.entry08Ui, before.profile.entry08, personal);
  await ctl.saveEntry08(before.storageRevision, update);
  ctl = await CurriculumController.open(supply, store, { getItem: () => null });
  const after = ctl.snapshot();
  assert.equal(after.profile.entry08.config.age, 'under8');
  assert.equal(after.profile.entry08Ui.answers.age, 'under8');
  personal = after.profile.personalPath08[entry.id];
  assert.deepEqual(personal.active, originalPersonal.active);
  assert.deepEqual(personal.observations, originalPersonal.observations);
  assert.deepEqual(personal.cursor, originalPersonal.cursor);
  assert.equal(personal.visit.budget, originalPersonal.visit.budget);
  const resumed = P.nextPersonal(P.pausePersonal(personal), supply.curriculum, { newVisit: true, visitBudget: 3 });
  assert.equal(resumed.visit.budget, 3);
});
await test('Consumed old budgets remain valid after lowering age; empty approaches adopt the new age', () => {
  const used = structuredClone(entry);
  used.visit.used = 5;
  used.total = 6;
  const result = syncProfileAge('7', ui, used);
  assert.equal(result.entry.visit.budget, 5);
  assert.equal(result.entry.totalBudget, 6);
  assert.equal(result.entry.visit.used, 5);
  assert.equal(result.entry.total, 6);
  assert.equal(syncProfileAge('7', ui, entry).entry.visit.budget, 3);
});
await test('Companion observations and pending reading verifier survive durable validation and reload', async () => {
  const c = supply.curriculum;
  const episode = Object.values(c.episodes).find(ep => ep.steps.some(step => c.items[step.itemId]?.kind === 'read'));
  const stepIndex = episode.steps.findIndex(step => c.items[step.itemId]?.kind === 'read');
  let run = structuredClone(personal);
  run.active = null; run.paused = false; run.episodeComplete = false;
  run.cursor = { ...run.cursor, nodeId: episode.nodeId, episodeId: episode.id, stepIndex };
  run.visit.used = 0;
  run = P.nextPersonal(run, c);
  run = P.answerPersonal(run, c, { kind: 'companion', actor: 'adult', correct: true, instanceId: run.active.instanceId });
  const state = ctl.snapshot();
  await ctl.saveEntry08(state.storageRevision, { ui: state.profile.entry08Ui, personal: run });
  ctl = await CurriculumController.open(supply, store, { getItem: () => null });
  const saved = ctl.snapshot().profile.personalPath08[entry.id];
  assert.equal(saved.observations.at(-1).verifier, 'companion');
  assert.equal(saved.active.readingVerifier, 'companion');
  const broken = ctl.snapshot();
  broken.profile.personalPath08[entry.id].observations.at(-1).verifier = 'made-up';
  assert.throws(() => validateState(broken, supply));
});
console.log(JSON.stringify({ suite: 'entry08-progression-age', passed: passed.length, failed: 0, tests: passed }, null, 2));
