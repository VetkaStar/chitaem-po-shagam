import type {
  ProgressState,
  Supply,
  Questionnaire,
} from '../../lib/curriculum/types.js';
import type {
  EntryCheckpoint,
  EntryPlacement,
  EntryRuntime,
  EntryStatus,
} from '../../lib/curriculum/entry-types.js';
import { entryPlanner } from '../../lib/curriculum/entry-planner.js';
import { engine } from '../../lib/curriculum/core.js';

export function ensureEntry(s: ProgressState): EntryRuntime {
  return (s.onboarding.entry ??= {
    access: { attempts: 0, passed: false },
    checkpoints: [],
    placement: null,
    suspendedInstance: null,
    practice: null,
    lastProbe: null,
    sideVisitId: null,
  });
}
export function checkpoint(s: ProgressState): EntryCheckpoint {
  const cp = ensureEntry(s).checkpoints.find(
    (c) => c.id === s.onboarding.checkpointId,
  );
  if (!cp) throw new Error('NO_ENTRY_CHECKPOINT');
  return cp;
}
export function entryAnswers(q: Questionnaire, supply: Supply) {
  const available = new Set(
    Object.values(supply.curriculum.items).flatMap((t) => t.interestTags ?? []),
  );
  return {
    ...q,
    interestTags: q.interests.filter((tag) => available.has(tag)),
  };
}
export function statuses(s: ProgressState, supply: Supply) {
  const result: Record<string, EntryStatus> = {};
  for (const cp of ensureEntry(s).checkpoints)
    result[cp.groupId] = entryPlanner.groupStatus(
      supply.registry,
      cp.groupId,
      cp.observations,
    );
  return result;
}
export function newCheckpoint(
  s: ProgressState,
  groupId: string,
  purpose: EntryCheckpoint['purpose'],
  id: string = crypto.randomUUID(),
) {
  s.onboarding.checkpointId = id;
  s.onboarding.currentCheckpointGroup = groupId;
  s.onboarding.checkpointPurpose = purpose;
  ensureEntry(s).checkpoints.push({
    id,
    groupId,
    purpose,
    metadata: {},
    observations: [],
    confirmed: false,
  });
  s.onboarding.screen = 'entry_checkpoint';
  ensureEntry(s).practice = null;
}
export function storePlacement(s: ProgressState, placement: EntryPlacement) {
  const { profileToPersist, ...saved } = placement;
  if (profileToPersist) s.profile = profileToPersist;
  ensureEntry(s).placement = saved;
  s.onboarding.screen = 'placement_report';
}
export function resolveEntry(s: ProgressState, supply: Supply, defer = false) {
  const q = entryAnswers(s.onboarding.questionnaire, supply),
    flow = ensureEntry(s);
  const target = s.onboarding.rootGoalGroup;
  const normalized = entryPlanner.normaliseAnswers(q);
  const saved = s.profile.programs[normalized.program];
  // A new placement must never replace an existing unfinished course screen.
  if (
    !defer &&
    (saved?.activeInfo || saved?.suspendedInstance || saved?.pendingAction)
  ) {
    storePlacement(s, {
      kind: 'resume_course',
      startProgramId: normalized.program,
    });
    return;
  }
  const probeState: Record<string, unknown> = { deferEntry: defer };
  for (const cp of flow.checkpoints)
    probeState[cp.groupId] = {
      usedItemIds: Object.values(cp.metadata).map((m) => m.itemId),
    };
  const result = entryPlanner.resolvePlacement(
    supply.curriculum,
    supply.registry,
    s.profile,
    q,
    target,
    statuses(s, supply),
    probeState,
  );
  storePlacement(s, result);
  if (
    defer &&
    s.onboarding.currentCheckpointGroup &&
    !s.onboarding.deferredGroups.includes(s.onboarding.currentCheckpointGroup)
  )
    s.onboarding.deferredGroups.push(s.onboarding.currentCheckpointGroup);
}
export function beginEntryCheck(s: ProgressState, supply: Supply) {
  if (s.onboarding.screen !== 'access_setup')
    throw new Error('ACCESS_SETUP_REQUIRED');
  const flow = ensureEntry(s),
    q = entryAnswers(s.onboarding.questionnaire, supply);
  if (!flow.access.passed || entryPlanner.accessDecision(q) !== 'OK')
    throw new Error('UI_ACCESS_REQUIRED');
  const a = entryPlanner.normaliseAnswers(q);
  s.onboarding.sideQueue = [...a.sideGroups];
  s.onboarding.rootGoalGroup = a.initialGroup;
  newCheckpoint(s, a.initialGroup, 'initial');
  if (!s.profile.currentVisit)
    s.profile = engine.beginVisit(s.profile, crypto.randomUUID(), {
      budget: a.budget,
    });
  if (!a.companionAvailable) resolveEntry(s, supply);
}
export function decideEntryGroup(
  s: ProgressState,
  supply: Supply,
  confirm: boolean,
) {
  const cp = checkpoint(s),
    result = entryPlanner.groupStatus(
      supply.registry,
      cp.groupId,
      cp.observations,
    );
  if (result.status === 'pending') throw new Error('ENTRY_GROUP_PENDING');
  if (confirm) {
    if (result.status !== 'pass' || !result.canConfirm)
      throw new Error('ENTRY_CONFIRMATION_UNAVAILABLE');
    const confirmed = entryPlanner.confirmEligibleGroups(
      s.profile,
      supply.curriculum,
      supply.registry,
      cp.observations,
      cp.id,
    );
    s.profile = confirmed.profile;
    cp.confirmed = true;
  }
  if (cp.purpose === 'initial')
    s.onboarding.rootGoalGroup = entryPlanner.chooseGoal(
      supply.registry,
      s.onboarding.questionnaire,
      cp.groupId,
      result,
      statuses(s, supply),
    ).groupId;
  if (cp.purpose === 'side') {
    s.onboarding.sideQueue = s.onboarding.sideQueue.filter(
      (g) => g !== cp.groupId,
    );
    const successor = supply.registry.groups[cp.groupId].successNextGroup;
    if (result.status === 'pass' && successor)
      s.onboarding.sideQueue.unshift(successor);
  }
  resolveEntry(s, supply);
}
