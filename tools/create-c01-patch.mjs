import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map(key => [key,item[key]])) : item);
const sha = value => createHash('sha256').update(value).digest('hex');
const raw = fs.readFileSync('content/curriculum/curriculum.json','utf8');
const curriculum = JSON.parse(raw);
const item = curriculum.items['task.1bb67acaeb41'];
const previousItemHash = item.contentHash;
const { contentHash: _hash, ...original } = item;
assert.equal(sha(canonical(original)),previousItemHash);
const changes = [{questionId:'q1',from:'text.fact',to:'text.sequence3'}, {questionId:'q2',from:'text.sequence3',to:'text.fact'}];
for (const questions of [item.questions,item.answer.questions]) for (const change of changes) {
  const question = questions.find(q => q.id === change.questionId);
  assert.deepEqual(question.skillIds,[change.from]);
  question.skillIds = [change.to];
}
const { contentHash: _oldHash, ...corrected } = item;
item.contentHash = sha(canonical(corrected));
curriculum.editorialRevision = '0.7.0+c01.1';
const patch = {id:'C-01',revision:curriculum.editorialRevision,approvedAt:'2026-10-26',
  approval:'Owner accepted preserving questions and correct answers, correcting only the two skill assignments.',
  baseCurriculumSha256:sha(raw), itemId:item.id, previousItemHash,
  itemHash:item.contentHash, curriculumSha256:sha(canonical(curriculum)), changes};
const registry = JSON.parse(fs.readFileSync('content/curriculum/entry_registry.json','utf8'));
registry.curriculumSha256 = patch.curriculumSha256;
registry.editorialRevision = patch.revision;
patch.registrySha256 = sha(canonical(registry));
const destination = 'content/curriculum/editorial-c01.json';
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(fs.readFileSync(destination,'utf8')),patch);
else fs.writeFileSync(destination,JSON.stringify(patch,null,2)+'\n');
console.log(JSON.stringify(patch,null,2));
