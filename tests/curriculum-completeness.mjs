import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compileCurriculum, supplyText } from './curriculum-harness.mjs';

const output = compileCurriculum();
const mod = (name) => import(pathToFileURL(output + '/' + name));
const { loadSupply } = await mod('lib/curriculum/loader.js');
const { engine, routeEngine } = await mod('lib/curriculum/core.js');
const { presentation } = await mod('features/curriculum/presentation.js');
const { informationFromSource } = await mod('features/curriculum/information-presentation.js');
const supply = await loadSupply(...supplyText());
const c = supply.curriculum;
const forbidden = new Set(['correctOptionIds', 'answer', 'acceptedBoundaries', 'partsAfterAnswer', 'resultText', 'feedback', 'expected', 'skillIds', 'targetWord']);
function noKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbidden.has(key), 'Grading key exposed: ' + key);
    noKeys(child);
  }
}
function taskProjection(item, mode, step, episode) {
  let p = engine.beginVisit(engine.createProfile('synthetic-completeness'), 'audit', { budget: 7 });
  p = routeEngine.launchFree(p, c, item.id, { mode, instanceId: 'audit-instance' });
  // Test the projection boundary in isolation; this is not a learner result or route completion.
  if (step) Object.assign(p.activeInstance, { episodeId: episode.id, stepId: step.id });
  const before = presentation(p, supply);
  noKeys(before);
  assert.equal(before.taskKind, item.kind);
  assert.equal(before.instruction, step?.instruction ?? item.assistantPrompt);
  assert.deepEqual(before.options, []);
  assert.deepEqual(before.questions, []);
  assert.deepEqual(before.hints, []);
  if (item.kind === 'compose') {
    assert.deepEqual(new Set(before.tokens.map(t => t.tokenId)), new Set(item.partTokens.map(t => t.tokenId)));
  }
  // Exercise the revealed projection without fabricating a reading verification.
  p.activeInstance.optionsRevealed = true;
  const after = presentation(p, supply);
  noKeys(after);
  assert.equal(after.options.length, item.options.length);
  assert.equal(after.questions.length, item.answer.kind === 'question_set' ? item.answer.questions.length : 0);
}
const nodeIds = new Set();
for (const program of c.programs) {
  for (const id of program.nodeIds) {
    assert(c.nodes[id], 'Missing node: ' + id);
    assert.equal(c.nodes[id].programId, program.id);
    nodeIds.add(id);
  }
  for (const id of program.defaultPath) assert(program.nodeIds.includes(id), 'Path outside program: ' + id);
}
assert.equal(nodeIds.size, Object.keys(c.nodes).length, 'Unlisted node');
const episodeIds = new Set();
for (const node of Object.values(c.nodes)) {
  for (const id of [...node.trainingIds, ...node.checkIds, ...(node.supplementalCheckIds ?? []), node.applicationId].filter(Boolean)) {
    assert(c.items[id], 'Missing node item: ' + id);
  }
  for (const id of node.episodeIds) {
    assert(c.episodes[id], 'Missing episode: ' + id);
    assert.equal(c.episodes[id].nodeId, node.id);
    assert.equal(c.episodes[id].programId, node.programId);
    episodeIds.add(id);
  }
}
const teachingEpisodes = episodeIds.size;
for (const method of ['p1', 'p2']) {
  const id = c.methodComparison[method].episodeId;
  assert.equal(c.episodes[id]?.purpose, 'demonstration', 'Missing demonstration');
  episodeIds.add(id);
}
assert.equal(episodeIds.size, Object.keys(c.episodes).length, 'Unlisted episode');
const actions = {}, kinds = {};
const supportedKinds = new Set(['read', 'choice', 'read_meaning', 'compose', 'boundary', 'find_part', 'transform', 'passage']);
const supportedActions = new Set(['task', 'show_chunks', 'model_blend', 'meaning_anchor', 'show_letter_contrast', 'explain_target', 'listen_context', 'optional_read_target', 'model_phrase', 'show_comparison', 'show_whole_to_parts', 'reveal_then_compose', 'whole_message', 'read_whole']);
let steps = 0, modes = 0;
for (const episode of Object.values(c.episodes)) {
  assert(episode.steps.length > 0, 'Empty episode: ' + episode.id);
  assert.equal(new Set(episode.steps.map(s => s.id)).size, episode.steps.length, 'Duplicate step');
  for (const [index, step] of episode.steps.entries()) {
    steps++;
    assert(supportedActions.has(step.action), 'Unaudited action: ' + step.action);
    actions[step.action] = (actions[step.action] ?? 0) + 1;
    assert.equal(step.next, episode.steps[index + 1]?.id ?? 'EPISODE_END', 'Broken next: ' + step.id);
    if (step.itemId) assert(c.items[step.itemId], 'Missing step item: ' + step.id);
    if (step.action === 'task') {
      const item = c.items[step.itemId];
      assert(item.allowedModes.includes(step.mode), 'Unsupported mode: ' + step.id);
      taskProjection(item, step.mode, step, episode);
    } else {
      const visible = informationFromSource(step, 'audit-info', supply);
      noKeys(visible);
      assert.equal(visible.instruction, step.instruction);
      assert(visible.texts.length || visible.spokenTexts.length || visible.instruction, 'Empty information: ' + step.id);
    }
  }
}
for (const item of Object.values(c.items)) {
  assert(supportedKinds.has(item.kind), 'Unsupported task renderer: ' + item.kind);
  kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
  for (const mode of item.allowedModes) {
    modes++;
    taskProjection(item, mode);
  }
}
console.log('PASS complete node/episode references and task/information projections');
console.log(JSON.stringify({ programs: c.programs.length, nodes: nodeIds.size, teachingEpisodes, episodes: episodeIds.size, steps, taskModes: modes, actions, kinds }, null, 2));
console.log('Scope: structural and projection audit only; C-01, editorial quality and learner trials are not certified.');
