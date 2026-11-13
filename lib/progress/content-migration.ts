import type { ProgressState, Supply } from '../curriculum/types.js';
import type { QuestionResult, TaskInstance } from '../curriculum/contracts.js';
import { c01Patch } from '../curriculum/editorial.js';
import { object } from '../curriculum/loader.js';
import { validateState } from './validation.js';
import { backfillPilotPreparation } from './pilot-exposure-migration.js';

/** Validate against the exact old snapshot before changing any data. No mastery is awarded. */
export function upgradeProgress(value: unknown, supply: Supply): { state: ProgressState; migrated: boolean } {
  if (object(value) && object(value.supply) && value.supply.curriculumSha256 === supply.registry.curriculumSha256) {
    validateState(value, supply);
    return { state: value, migrated: false };
  }
  if (!supply.previous) {
    validateState(value, supply);
    return { state: value, migrated: false };
  }
  const prior = upgradeProgress(value, supply.previous);
  return upgradeOne(prior.state, supply);
}

function upgradeOne(value: unknown, supply: Supply): { state: ProgressState; migrated: boolean } {
  const legacy = supply.previous;
  if (!legacy || !object(value) || !object(value.supply) ||
      value.supply.curriculumSha256 !== legacy.registry.curriculumSha256) {
    validateState(value, supply);
    return { state: value, migrated: false };
  }
  validateState(value, legacy);
  const state = structuredClone(value);
  if (supply.registry.curriculumSha256 !== c01Patch.curriculumSha256) {
    // Additive pilot: every existing item, cursor, receipt and parked instance remains byte-for-byte intact.
    state.supply.curriculumSha256 = supply.registry.curriculumSha256;
    state.onboarding.curriculumSha256 = supply.registry.curriculumSha256;
    backfillPilotPreparation(state, supply);
    state.profile.revision++;
    validateState(state, supply);
    return { state, migrated: true };
  }
  const originals: TaskInstance[] = [];
  const updateResults = (results: QuestionResult[]) => results.map(result => {
    const change = c01Patch.changes.find(change => change.questionId === result.questionId);
    if (!change || result.skillIds.length !== 1 || result.skillIds[0] !== change.from)
      throw new Error('C01_LEGACY_QUESTION_RESULT_MISMATCH');
    return { ...result, skillIds: [change.to] };
  });
  const update = (instance: TaskInstance | null | undefined) => {
    if (!instance || instance.itemId !== c01Patch.itemId) return;
    originals.push(structuredClone(instance));
    instance.contentHash = c01Patch.itemHash;
    if (instance.lastPartial?.questionResults)
      instance.lastPartial.questionResults = updateResults(instance.lastPartial.questionResults);
    if ('questionResults' in instance) {
      const attempt = instance as TaskInstance & { questionResults: QuestionResult[]; subskillIds: string[] };
      attempt.questionResults = updateResults(attempt.questionResults);
      attempt.subskillIds = attempt.questionResults.filter(result => result.outcome === 'correct').flatMap(result => result.skillIds);
    }
  };
  const p = state.profile;
  update(p.activeInstance);
  p.attempts.forEach(update);
  Object.values(p.programs).forEach(position => update(position.suspendedInstance));
  update(state.suspendedFreeInstance);
  Object.values(state.customRoutes).forEach(route => update(route.suspendedInstance));
  Object.values(state.demonstrationRuns ?? {}).forEach(run => update(run?.suspendedInstance));
  update(state.onboarding.entry?.suspendedInstance);
  p.legacyPractice.push({ source: 'editorial-c01', revision: c01Patch.revision,
    fromCurriculumSha256: legacy.registry.curriculumSha256, originalInstances: originals });
  p.revision++;
  state.supply.curriculumSha256 = supply.registry.curriculumSha256;
  state.onboarding.curriculumSha256 = supply.registry.curriculumSha256;
  validateState(state, supply);
  return { state, migrated: true };
}

/** Backups retain their original bytes and schema; reading one never migrates it in place. */
export function validateStoredSnapshot(value: unknown, supply: Supply): void {
  const candidate = object(value) && object(value.supply) ? value.supply.curriculumSha256 : null;
  let snapshot = supply;
  while (snapshot.previous && snapshot.registry.curriculumSha256 !== candidate) snapshot = snapshot.previous;
  validateState(value, snapshot);
}
