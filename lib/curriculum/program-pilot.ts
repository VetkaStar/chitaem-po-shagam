import patch from '../../content/curriculum/program-pilot-v1.json';
import type { CustomStep, Supply, Task } from './types.js';
import { canonicalJson } from './editorial.js';

export interface ProgramPracticeBranch {
  id: string;
  blockId: string;
  method: 'p1' | 'p2';
  programId: string;
  anchorNodeId: string;
  title: string;
  steps: CustomStep[];
}
export const programPilot = patch;
export const programPracticeBranches = patch.branches as ProgramPracticeBranch[];

/** Local overlay. The base remains available for validated, lossless snapshot migration. */
export async function applyProgramPilot(base: Supply, hash: (raw: string) => Promise<string>): Promise<Supply> {
  if (base.registry.curriculumSha256 !== patch.baseCurriculumSha256) throw new Error('PILOT_BASE_MISMATCH');
  const curriculum = structuredClone(base.curriculum);
  for (const [id, task] of Object.entries(patch.items)) {
    if (curriculum.items[id]) throw new Error('PILOT_ID_COLLISION');
    const { contentHash, ...content } = task;
    if (await hash(canonicalJson(content)) !== contentHash) throw new Error('PILOT_ITEM_HASH');
    curriculum.items[id] = structuredClone(task) as Task;
  }
  for (const reserve of patch.reserves) {
    const set = curriculum.taskSets[reserve.taskSetId] as { supplementalCheckIds?: string[] };
    if (!set) throw new Error('PILOT_RESERVE_SET');
    set.supplementalCheckIds = [...(set.supplementalCheckIds ?? []), reserve.itemId];
    for (const node of Object.values(curriculum.nodes)) if (node.taskSetId === reserve.taskSetId)
      node.supplementalCheckIds = [...(node.supplementalCheckIds ?? []), reserve.itemId];
  }
  for (const branch of programPracticeBranches) {
    if (curriculum.nodes[branch.anchorNodeId]?.programId !== branch.programId) throw new Error('PILOT_ANCHOR');
    for (const step of branch.steps) if (!curriculum.items[step.itemId]) throw new Error('PILOT_STEP');
  }
  curriculum.editorialRevision = patch.revision;
  curriculum.programPracticeBranches = structuredClone(programPracticeBranches);
  const registry = { ...base.registry, editorialRevision: patch.revision, curriculumSha256: await hash(canonicalJson(curriculum)) };
  return { curriculum, registry, previous: base };
}
