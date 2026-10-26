import patch from '../../content/curriculum/editorial-c01.json';
import type { Supply } from './types.js';
import type { Question } from './contracts.js';

export { patch as c01Patch };
/** Same canonical JSON ordering as the supplier's item hash validator. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort((a,b) => a < b ? -1 : a > b ? 1 : 0).map(key => [key,item[key]])) : item);
}
export async function applyEditorial(base: Supply, hash: (raw: string) => Promise<string>): Promise<Supply> {
  if (base.registry.curriculumSha256 !== patch.baseCurriculumSha256) throw new Error('EDITORIAL_BASE_MISMATCH');
  const original = base.curriculum.items[patch.itemId];
  if (original.contentHash !== patch.previousItemHash) throw new Error('EDITORIAL_ITEM_MISMATCH');
  const item = structuredClone(original) as typeof original & { questions: Question[] };
  if (item.answer.kind !== 'question_set') throw new Error('EDITORIAL_QUESTION_MISMATCH');
  for (const questions of [item.questions, item.answer.questions]) for (const change of patch.changes) {
    const question = questions.find(q => q.id === change.questionId);
    if (!question || canonicalJson(question.skillIds) !== canonicalJson([change.from])) throw new Error('EDITORIAL_SKILL_MISMATCH');
    question.skillIds = [change.to];
  }
  const { contentHash: _previousHash, ...content } = item;
  item.contentHash = await hash(canonicalJson(content));
  if (item.contentHash !== patch.itemHash) throw new Error('EDITORIAL_ITEM_HASH');
  const curriculum = { ...base.curriculum, editorialRevision: patch.revision,
    items: { ...base.curriculum.items, [item.id]: item } };
  const registry = { ...base.registry, editorialRevision: patch.revision, curriculumSha256: patch.curriculumSha256 };
  if (await hash(canonicalJson(curriculum)) !== patch.curriculumSha256 ||
      await hash(canonicalJson(registry)) !== patch.registrySha256) throw new Error('EDITORIAL_SNAPSHOT_HASH');
  return { curriculum, registry, previous: base };
}
