/** Verify disclosure/save ordering against the actual pilot branches and controller. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.local/pilot-media-20261105/controller-runtime');
// Isolated equivalent of curriculum-harness; does not race its shared output.
function compile(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const source = path.join(relative, entry.name);
    if (entry.isDirectory()) { compile(source); continue; }
    if (!/\.(ts|mjs)$/.test(entry.name)) continue;
    const destination = path.join(output, source.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (entry.name.endsWith('.mjs')) { fs.copyFileSync(path.join(root, source), destination); continue; }
    const code = ts.transpileModule(fs.readFileSync(path.join(root, source), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
      .replace(/from\s+(['"])(\.[^'"]+)\1/g, (all, quote, spec) => /\.(json|js|mjs)$/.test(spec) ? all : `from ${quote}${spec}.js${quote}`)
      .replace(/import\s+(\w+)\s+from\s+['"]([^'"]+\.json)['"];?/g, (_, name, spec) => `const ${name} = ${fs.readFileSync(path.resolve(root, path.dirname(source), spec), 'utf8')};`);
    fs.writeFileSync(destination, code);
  }
}
for (const dir of ['lib/curriculum', 'lib/progress', 'lib/entry08', 'features/curriculum', 'features/onboarding', 'features/roadmap']) compile(dir);
const mod = (name) => import(pathToFileURL(path.join(output, name)));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { createState } = await mod('lib/progress/state.js');
const { validateState } = await mod('lib/progress/validation.js');
const { CurriculumController } = await mod('features/curriculum/controller.js');
const { programPracticeBranches } = await mod('lib/curriculum/program-pilot.js');
const supply = await loadSupply(...['curriculum.json', 'entry_registry.json'].map((name) => fs.readFileSync(path.join(root, 'content/curriculum', name), 'utf8')));
const legacy = { getItem: () => null };
const report = [];
for (const branch of programPracticeBranches.filter((b) => ['lampa', 'krupa', 'story-catfish', 'story-sled', 'story-bag'].includes(b.blockId))) {
  const initial = createState(supply, legacy);
  initial.profile.knownLetters = Array.from('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ');
  initial.profile.availableCapabilities = [...new Set(Object.values(supply.curriculum.items).flatMap((task) => task.requiredCapabilities))];
  const store = {
    state: null, fail: false,
    async read() { return structuredClone(this.state); },
    async commit(next, revision) {
      validateState(next, supply);
      assert.equal(this.state?.storageRevision ?? null, revision);
      if (this.fail) throw Error('TEST_STORAGE_FAILURE');
      this.state = structuredClone({ ...next, storageRevision: (revision ?? -1) + 1 });
      return this.read();
    },
  };
  await store.commit(initial, null);
  const ctl = await CurriculumController.open(supply, store, legacy);
  await ctl.selectProgram(branch.programId);
  await ctl.selectProgramPractice(branch.id);
  let reached = false;
  for (let index = 0; index < branch.steps.length; index++) {
    if (ctl.snapshot().profile.currentVisit?.actions >= ctl.snapshot().profile.currentVisit?.budget) await ctl.endVisit();
    if (!ctl.snapshot().profile.currentVisit) await ctl.beginVisit(crypto.randomUUID(), 7);
    const view = await ctl.launch(await ctl.planNext());
    if (view.kind === 'info') { await ctl.acknowledge(view.planId); continue; }
    const task = supply.curriculum.items[ctl.snapshot().profile.activeInstance.itemId];
    if (task.kind === 'compose') { await ctl.answer({ instanceId: view.instanceId, response: { tokenIds: task.partTokens.map((part) => part.tokenId) } }); continue; }
    assert(view.canShowIllustration, branch.id + ': missing media policy/match');
    assert.equal(view.illustration, undefined, 'Image and alt remain absent before explicit help');
    const before = ctl.snapshot();
    store.fail = true;
    await assert.rejects(ctl.illustration(view.instanceId), /TEST_STORAGE_FAILURE/);
    assert.deepEqual(ctl.snapshot(), before);
    assert.equal(ctl.visible().illustration, undefined, 'Failed persistence cannot disclose the scene');
    store.fail = false;
    await assert.rejects(ctl.illustration('stale'), /STALE/);
    await ctl.illustration(view.instanceId);
    assert(ctl.snapshot().profile.activeInstance.helpLevel >= 1);
    assert(ctl.visible().illustration);
    assert.deepEqual(store.state.profile.activeInstance, ctl.snapshot().profile.activeInstance);
    const reopened = await CurriculumController.open(supply, store, legacy);
    assert.deepEqual(reopened.visible(), ctl.visible());
    if (task.kind === 'passage') await assert.rejects(ctl.illustration(view.instanceId, 'context'), /INVALID/);
    else {
      await ctl.illustration(view.instanceId, 'alternate');
      assert.equal(ctl.visible().illustration.variant, 'alternate');
      assert(ctl.snapshot().profile.activeInstance.helpLevel >= 1);
    }
    assert.deepEqual(ctl.snapshot().profile.confirmedSkills, before.profile.confirmedSkills);
    report.push({ branch: branch.id, item: task.id, asset: ctl.visible().illustration, failedSaveHidden: true, helpPersisted: true, restored: true });
    reached = true;
    break;
  }
  assert(reached, branch.id + ': no target reached');
}
assert.equal(report.length, 10);
fs.writeFileSync(path.join(root, '.local/pilot-media-20261105/controller-media.json'), JSON.stringify(report, null, 2));
console.log('PASS 10 pilot branches: exact new media, hidden initially/on failed save, persisted help before display, reload, variant guards, no mastery changes.');
