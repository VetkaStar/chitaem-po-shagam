import { engine } from '../curriculum/core.js';
import { CURRICULUM_SHA } from '../curriculum/loader.js';
import type { ProgressState, Supply } from '../curriculum/types.js';
import { LEGACY_KEYS, validateState } from './validation.js';
/** Reads only the established site keys; does not write, delete or migrate them in-place. */
export function createState(
  supply: Supply,
  legacyStorage: Pick<Storage, 'getItem'>,
  id: string = crypto.randomUUID(),
): ProgressState {
  const values: Record<string, string | null> = {};
  // A blocked localStorage is not an empty profile. Let the caller report the failure.
  for (const key of LEGACY_KEYS) values[key] = legacyStorage.getItem(key);
  let profile = engine.createProfile(id);
  for (const manifest of supply.curriculum.programs)
    profile = engine.switchProgram(profile, manifest.id, supply.curriculum);
  profile.currentProgramId = null;
  const state: ProgressState = {
    schemaVersion: 2,
    storageRevision: 0,
    supply: {
      curriculumVersion: '0.7.0',
      curriculumSha256: CURRICULUM_SHA,
      specVersion: 'onboarding-0.7.3',
    },
    profile,
    studyMode: 'free',
    route: null,
    customRoutes: {},
    suspendedFreeInstance: null,
    legacy: { capturedAt: new Date().toISOString(), values },
    sourceEvents: [],
    onboarding: {
      schemaVersion: 1,
      specVersion: 'onboarding-0.7.3',
      curriculumSha256: CURRICULUM_SHA,
      setupStatus: 'not_started',
      screen: 'questionnaire',
      questionnaireStep: null,
      questionnaire: {
        respondent: null,
        ageBand: null,
        reads: null,
        blendingDifficulty: null,
        companionAvailable: null,
        program: null,
        budget: null,
        interests: [],
      },
      checkpointId: null,
      checkpointPurpose: null,
      currentCheckpointGroup: null,
      rootGoalGroup: null,
      returnToNodeId: null,
      deferredGroups: [],
      sideQueue: [],
    },
  };
  validateState(state, supply);
  return state;
}
export function encodeProgress(state: ProgressState, supply: Supply): string {
  validateState(state, supply);
  return JSON.stringify({
    format: 'reading-platform-export',
    version: 2,
    state,
  });
}
export function decodeProgress(raw: string, supply: Supply): ProgressState {
  if (typeof raw !== 'string' || raw.length > 20_000_000)
    throw new Error('INVALID_IMPORT_SIZE');
  const payload: unknown = JSON.parse(raw);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('format' in payload) ||
    payload.format !== 'reading-platform-export' ||
    !('version' in payload) ||
    payload.version !== 2 ||
    !('state' in payload)
  )
    throw new Error('INCOMPATIBLE_IMPORT');
  validateState(payload.state, supply);
  return structuredClone(payload.state);
}
