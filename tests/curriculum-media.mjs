import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';
const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { illustrationMatch } = await mod(
  'features/curriculum/illustration-match.js',
);
const supply = await loadSupply(...supplyText());
const tasks = Object.values(supply.curriculum.items);
const { engine } = await mod('lib/curriculum/core.js');
const legacy = { getItem: () => null };
async function fixture(task) {
  const store = {
    state: null,
    fail: false,
    async read() {
      return structuredClone(this.state);
    },
    async commit(next, expected) {
      validateState(next, supply);
      if (this.fail) throw new Error('STORAGE_FAILED');
      assert.equal(expected, this.state?.storageRevision ?? null);
      this.state = structuredClone({
        ...next,
        storageRevision: (expected ?? -1) + 1,
      });
      return this.read();
    },
  };
  const controller = await CurriculumController.open(supply, store, legacy);
  await controller.beginVisit('media-visit', 7);
  await controller.launchFree(task.id, 'read', 'media-instance');
  return { controller, store };
}
const word = tasks.find(
  (t) =>
    t.freeTrainerVisible &&
    t.allowedModes.includes('read') &&
    illustrationMatch(t)?.kind === 'word',
);
assert(word);
{
  const { controller: c, store } = await fixture(word);
  assert.equal(c.visible().illustration, undefined);
  const before = c.snapshot();
  await assert.rejects(c.illustration('old-instance'), /STALE/);
  store.fail = true;
  await assert.rejects(c.illustration('media-instance'), /STORAGE_FAILED/);
  assert.deepEqual(c.snapshot(), before);
  assert.equal(c.visible().illustration, undefined);
  store.fail = false;
  await c.illustration('media-instance');
  assert.equal(c.visible().illustration.variant, 'main');
  assert(c.snapshot().profile.activeInstance.helpLevel >= 1);
  const reopened = await CurriculumController.open(supply, store, legacy);
  assert.deepEqual(reopened.visible(), c.visible());
  await c.illustration('media-instance', 'alternate');
  assert.equal(c.visible().illustration.variant, 'alternate');
  const forged = c.snapshot();
  forged.profile.activeInstance.helpLevel = 0;
  assert.throws(() => validateState(forged, supply), /illustration/);
  console.log(
    'PASS image: no disclosure on failed save, persisted variant/help and reload',
  );
}
const passage = tasks.find(
  (t) =>
    t.kind === 'passage' &&
    t.freeTrainerVisible &&
    t.allowedModes.includes('read'),
);
{
  const { controller: c, store } = await fixture(passage);
  const q = passage.answer.questions[0];
  const before = c.snapshot();
  await assert.rejects(
    c.optionAudio('media-instance', q.id, q.options[0].id),
    /OPTIONS_HIDDEN/,
  );
  assert.deepEqual(c.snapshot(), before);
  await c.recordReading('media-instance', {
    verifier: 'companion',
    correct: true,
  });
  await c.revealOptions();
  const shown = c.visible(),
    saved = c.snapshot();
  store.fail = true;
  await assert.rejects(
    c.optionAudio('media-instance', q.id, null),
    /STORAGE_FAILED/,
  );
  assert.deepEqual(c.snapshot(), saved);
  store.fail = false;
  assert.equal(await c.optionAudio('media-instance', q.id, null), q.prompt);
  assert.equal(
    await c.optionAudio('media-instance', q.id, q.options[0].id),
    q.options[0].text,
  );
  assert.deepEqual(c.visible().questions, shown.questions);
  assert.deepEqual(c.visible().selectedAnswers, shown.selectedAnswers);
  await assert.rejects(c.optionAudio('stale', q.id, null), /STALE/);
  await assert.rejects(
    c.optionAudio('media-instance', 'unknown', null),
    /UNKNOWN/,
  );
  await assert.rejects(
    c.optionAudio('media-instance', q.id, 'unknown'),
    /UNKNOWN/,
  );
  console.log(
    'PASS audio: stage gating, identity, save failure, stable options and no answer selection',
  );
}
const exactAudio = tasks.find(t => t.freeTrainerVisible && t.allowedModes.includes('read')
  && t.options.some(o => engine.normalise(o.text) === engine.normalise(t.learnerText)));
assert(exactAudio);
{
  const { controller: c } = await fixture(exactAudio);
  await c.revealOptions();
  const option = exactAudio.options.find(o => engine.normalise(o.text) === engine.normalise(exactAudio.learnerText));
  await c.optionAudio('media-instance', null, option.id);
  assert.equal(c.snapshot().profile.activeInstance.readingTargetAudioPlayed, true);
  for (const hint of c.visible().hints)
    assert(c.snapshot().profile.exposures.stimuli.includes(engine.normalise(hint)));
  console.log('PASS target audio: assistance and simultaneously revealed hints are durable');
}
for (const text of ['МЫШЬ', 'ЛИСТ', 'ЛУК', 'КЛЮЧ', 'КАРТА', 'ПОРТ', '__proto__'])
  assert.equal(illustrationMatch({ ...word, learnerText: text }), null);
assert.equal(illustrationMatch({ ...word, mediaPolicy: undefined }), null);
assert.equal(illustrationMatch({ ...word, meaningKey: 'ДРУГОЕ' }), null);
const story = tasks.find(
  (t) =>
    t.freeTrainerVisible &&
    t.allowedModes.includes('read') &&
    illustrationMatch(t)?.kind === 'story',
);
assert(story);
{
  const { controller: c } = await fixture(story);
  await assert.rejects(c.illustration('media-instance', 'context'), /INVALID/);
  await c.illustration('media-instance');
  assert.equal(c.visible().illustration.kind, 'story');
  assert(c.snapshot().profile.activeInstance.helpLevel >= 1);
  console.log(
    'PASS story: only exact authored series, saved help before ordered frames',
  );
}
