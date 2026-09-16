import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(
  new URL('../features/trainers/task-section.ts', import.meta.url),
  'utf8',
);
const exports = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports },
);
const { taskSection } = exports;
const bank = JSON.parse(
  fs.readFileSync(
    new URL('../content/curriculum/curriculum.json', import.meta.url),
    'utf8',
  ),
);
const items = Object.values(bank.items);

// All supplied items, before visibility/protected-reserve filtering.
//                 letters syllables words sentences stories
const expected = {
  compose: { syllables: 15, words: 63, sentences: 2 },
  find_part: { syllables: 12, words: 95, sentences: 38, stories: 10 },
  choice: { letters: 64, syllables: 3, words: 89, sentences: 10 },
  read_meaning: { words: 11 },
  boundary: { words: 16 },
  transform: { words: 62 },
};
for (const [kind, counts] of Object.entries(expected)) {
  const actual = {};
  for (const task of items.filter((item) => item.kind === kind)) {
    const section = taskSection(task);
    actual[section] = (actual[section] ?? 0) + 1;
  }
  assert.deepEqual(actual, counts, kind);
}

// Every explicit exception must continue to exist in the authoritative bank.
for (const id of new Set(source.match(/task\.[a-z0-9.]+/g))) {
  if (
    id === 'task.id' ||
    id.startsWith('task.kind') ||
    id.startsWith('task.evidence') ||
    id.startsWith('task.skill')
  )
    continue;
  assert.ok(bank.items[id], `Unknown section exception ${id}`);
}
for (const task of items.filter(
  (item) =>
    item.kind === 'find_part' &&
    item.skillIds?.includes('analyse.meaning_component'),
)) {
  assert.ok(['sentences', 'stories'].includes(taskSection(task)), task.id);
}
assert.equal(
  taskSection(bank.items['task.af03c001f901']),
  'words',
  'Pairs of words remain word material',
);
assert.equal(
  taskSection(bank.items['task.805219bc6593']),
  'words',
  'Related object names are not a narrative',
);
assert.equal(
  taskSection(bank.items['task.8da5e97375d7']),
  'sentences',
  'Compared sentences are not a connected story',
);
assert.equal(
  taskSection(bank.items['task.v7.5aaf284458b7']),
  'stories',
  'A sequence of events is a mini-story',
);
console.log('Trainer section partition: 490 tasks, six kinds, PASS');
