import type { Profile } from '../curriculum/contracts.js';
import type { ProgressState, Supply } from '../curriculum/types.js';
import { engine } from '../curriculum/core.js';
import {
  CURRICULUM_SHA,
  demand,
  object,
  natural,
  own,
} from '../curriculum/loader.js';
import { jsonTree } from './validation-helpers.js';
import { instanceValidator } from './validation-instances.js';
import { validatePrograms } from './validation-programs.js';
import { validateEvidence } from './validation-evidence.js';
import { validateSourceOwnership } from './validation-sources.js';
import { validatePlatform } from './validation-platform.js';
import { validateDemonstrations } from './validation-demonstrations.js';
import { validateEntry } from './validation-entry.js';
import { validateEntry08 } from './validation-entry08';
export { LEGACY_KEYS } from './validation-helpers.js';
export function validateState(
  value: unknown,
  supply: Supply,
): asserts value is ProgressState {
  jsonTree(value);
  const c = supply.curriculum;
  demand(
    object(value) &&
      value.schemaVersion === 2 &&
      natural(value.storageRevision),
    'platform version/revision',
  );
  const s = value;
  demand(
    object(s.supply) &&
      s.supply.curriculumVersion === '0.7.0' &&
      s.supply.curriculumSha256 === CURRICULUM_SHA &&
      s.supply.specVersion === 'onboarding-0.7.3',
    'supply version',
  );
  let failures: string[];
  try {
    failures = engine.validateProfile(s.profile, c);
  } catch {
    throw new Error('INVALID_PROFILE_SHAPE');
  }
  demand(failures.length === 0, 'profile ' + failures.join(', '));
  const p = s.profile as unknown as Profile;
  demand(natural(p.revision), 'profile revision');
  demand(
    p.availableCapabilities.every((id) => own(c.capabilitySupports, id)) &&
      p.confirmedSkills.every((id) => own(c.skills, id)),
    'own catalog keys',
  );
  const instance = instanceValidator(p, c);
  if (p.currentProgramId !== null)
    demand(own(p.programs, p.currentProgramId), 'current position missing');
  const activeIds = new Set<string>();
  const active = (v: unknown) => {
    if (v === null) return;
    instance(v);
    const id = (v as { instanceId: string }).instanceId;
    demand(!activeIds.has(id), 'duplicate active instance');
    activeIds.add(id);
  };
  active(p.activeInstance);
  if (p.activeInstance?.context === 'route')
    demand(
      p.activeInstance.programId === p.currentProgramId &&
        s.studyMode === 'recommended',
      'active source ownership',
    );
  active(s.suspendedFreeInstance);
  validatePrograms(p, c, active);
  validateEvidence(p, c, instance);
  validatePlatform(s, supply, active);
  validateDemonstrations(s as unknown as ProgressState, supply, active);
  validateEntry(s as unknown as ProgressState, supply, active);
  validateEntry08(p,c);
  validateSourceOwnership(s as unknown as ProgressState);
}
