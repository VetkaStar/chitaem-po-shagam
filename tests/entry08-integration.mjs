import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
await import('../tools/verify-entry08.mjs');
const out = compileCurriculum(),
  mod = (n) => import(pathToFileURL(`${out}/${n}`));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { migrateAnswers, questionPage } = await mod('lib/entry08/migration.js');
const { entryHistory } = await mod('lib/entry08/profile.js');
const E = await mod('lib/entry08/vendor/lite-entry.mjs');
const bank = JSON.parse(
  fs.readFileSync('content/curriculum/lite-bank.json', 'utf8'),
);
const supply = await loadSupply(...supplyText());
class Store {
  state = null;
  backups = [];
  fail = false;
  async read() {
    return structuredClone(this.state);
  }
  async commit(s, rev, backup) {
    validateState(s, supply);
    if (this.fail) throw Error('SAVE_FAILED');
    assert.equal(this.state?.storageRevision ?? null, rev);
    if (backup) this.backups.push(structuredClone(this.state));
    this.state = structuredClone({ ...s, storageRevision: (rev ?? -1) + 1 });
    return this.read();
  }
}
const store = new Store(),
  ctl = await CurriculumController.open(supply, store, { getItem: () => null });
const initial = ctl.snapshot();
const answers = migrateAnswers(initial, '9');
assert.equal(answers.age, '8to12');
assert.equal(questionPage(answers), 'role');
assert.equal(migrateAnswers(initial, '12+').age, 'unknown');
const legacyHistory = structuredClone(initial.profile);
legacyHistory.currentVisit = {
  id: 'old',
  index: 0,
  budget: 3,
  actions: 0,
  checkedNodes: [],
};
legacyHistory.exposures.events = [
  {
    visitId: 'old',
    texts: [],
    heardPassages: [],
    promptedTexts: ['КО́Т.'],
    itemIds: [],
  },
];
assert.deepEqual(entryHistory(legacyHistory).promptedTargetsThisVisit, ['КОТ']);
let ui = {
  version: '0.8.1',
  answers: { ...answers, respondent: 'child', interests: ['technology'] },
  page: 'access',
};
await ctl.saveEntry08(initial.storageRevision, { ui });
assert.deepEqual(store.backups, [initial]);
let e = E.accessReady(
  E.createEntry({ ...ui.answers, input: 'voice' }, 'integration'),
  { voiceAvailable: true, voiceOptIn: true },
);
e = E.openCard(e, bank, E.nextScreen(e, bank));
await ctl.saveEntry08(ctl.snapshot().storageRevision, {
  ui: { ...ui, page: 'probe' },
  entry: e,
});
const opened = ctl.snapshot();
assert.equal(opened.profile.entry08.total, 1);
assert.equal(opened.profile.exposures.events.length, 1);
await ctl.saveEntry08(opened.storageRevision, {
  ui: { ...ui, page: 'probe' },
  entry: e,
});
assert.equal(ctl.snapshot().profile.exposures.events.length, 1);
const active = E.startCapture(e, 'c');
const partial = E.submitSpeech(active, bank, {
  instanceId: e.active.instanceId,
  captureId: 'c',
  transcript: bank.cards[e.active.cardId].target,
  isFinal: false,
});
assert.deepEqual(partial, active);
const observed = E.submitSpeech(active, bank, {
  instanceId: e.active.instanceId,
  captureId: 'c',
  transcript: bank.cards[e.active.cardId].target,
  isFinal: true,
  confidence: 0.99,
});
await ctl.saveEntry08(ctl.snapshot().storageRevision, {
  ui: { ...ui, page: 'probe' },
  entry: observed,
});
assert.deepEqual(ctl.snapshot().profile.attempts, initial.profile.attempts);
assert.deepEqual(
  ctl.snapshot().profile.confirmedSkills,
  initial.profile.confirmedSkills,
);
assert(!JSON.stringify(ctl.snapshot().profile.entry08).includes('transcript'));
const before = ctl.snapshot();
store.fail = true;
await assert.rejects(
  ctl.saveEntry08(before.storageRevision, { ui, entry: E.next(observed) }),
  /SAVE_FAILED/,
);
assert.deepEqual(ctl.snapshot(), before);
store.fail = false;
await assert.rejects(
  ctl.saveEntry08(before.storageRevision - 1, { ui }),
  /REVISION_CONFLICT/,
);
const corrupt = structuredClone(before);
corrupt.profile.entry08.total = 100;
assert.throws(() => validateState(corrupt, supply));
const roundtrip = JSON.parse(await ctl.export());
assert.equal(roundtrip.state.profile.entry08.id, 'integration');
console.log(
  'PASS entry08 integration: migration, atomic backup, exposure idempotency, final-only observation, legacy preservation, failed save, CAS, validation/export',
);
