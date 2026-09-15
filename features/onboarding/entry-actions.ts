import type {
  ProgressState,
  Supply,
  Questionnaire,
} from '../../lib/curriculum/types.js';
import type { EntryPractice } from '../../lib/curriculum/entry-types.js';
import { entryPlanner } from '../../lib/curriculum/entry-planner.js';
import { engine } from '../../lib/curriculum/core.js';
import {
  ensureEntry,
  checkpoint,
  newCheckpoint,
  beginEntryCheck,
  resolveEntry,
  entryAnswers,
} from './entry-state.js';

export function questionnaireReady(s: ProgressState) {
  if (s.profile.activeInstance || ensureEntry(s).suspendedInstance)
    throw new Error('FINISH_ENTRY_TASK_FIRST');
  s.onboarding.screen = 'access_setup';
  s.onboarding.setupStatus = 'in_progress';
}
export function accessSave(s: ProgressState, q: Questionnaire) {
  if (s.onboarding.screen !== 'access_setup')
    throw new Error('ACCESS_SETUP_REQUIRED');
  s.onboarding.questionnaire = structuredClone(q);
  ensureEntry(s).access = { attempts: 0, passed: false };
}
export function accessAnswer(s: ProgressState, shape: 'circle' | 'square') {
  const flow = ensureEntry(s);
  if (
    s.onboarding.screen !== 'access_setup' ||
    flow.access.passed ||
    flow.access.attempts >= 2
  )
    throw new Error('ACCESS_SETUP_REQUIRED');
  if (!['circle', 'square'].includes(shape)) throw new Error('INVALID_SHAPE');
  flow.access.attempts++;
  flow.access.passed =
    shape === 'circle' &&
    entryPlanner.accessDecision(s.onboarding.questionnaire) === 'OK';
}
export function deferCheck(s: ProgressState, supply: Supply) {
  if (s.profile.activeInstance) throw new Error('PAUSE_CURRENT_ENTRY_FIRST');
  resolveEntry(s, supply, true);
}
export function startPractice(s: ProgressState, supply: Supply) {
  const f = ensureEntry(s),
    placement = f.placement;
  if (s.profile.activeInstance || f.suspendedInstance)
    throw new Error('FINISH_ENTRY_TASK_FIRST');
  const plan =
    placement?.kind === 'provisional_free'
      ? (placement as unknown as EntryPractice)
      : (placement?.practice ??
        (placement?.kind === 'side_support' &&
        s.onboarding.currentCheckpointGroup
          ? entryPlanner.practicePlan(
              supply.curriculum,
              supply.registry,
              s.onboarding.currentCheckpointGroup,
              entryAnswers(s.onboarding.questionnaire, supply),
              'SIDE_SUPPORT',
            )
          : null));
  if (!plan) throw new Error('NO_ENTRY_PRACTICE');
  f.practice = {
    id: crypto.randomUUID(),
    plan: structuredClone(plan),
    position: 0,
    completedInstanceIds: [],
  };
  s.studyMode = 'entry';
  s.route = { source: 'entry', routeId: 'onboarding', version: 1 };
}
export function requestPrerequisite(s: ProgressState, supply: Supply) {
  const p = ensureEntry(s).placement,
    group = p?.next?.groupId;
  if (p?.kind !== 'entry_checkpoint_needed' || typeof group !== 'string')
    throw new Error('NO_PENDING_PREREQUISITE');
  newCheckpoint(s, group, 'prerequisite');
}
export function requestSide(s: ProgressState, supply: Supply) {
  const flow = ensureEntry(s),
    v = s.profile.currentVisit,
    group = s.onboarding.sideQueue[0];
  if (
    s.onboarding.screen !== 'placement_report' ||
    !v ||
    v.budget - v.actions < 2 ||
    flow.sideVisitId === v.id ||
    !group ||
    s.profile.activeInstance
  )
    throw new Error('SIDE_CHECK_NOT_AVAILABLE');
  if (
    ['LP_WORD', 'MS_WORD'].includes(group) &&
    !s.profile.confirmedSkills.includes('decode.cv_cv')
  )
    throw new Error('SIDE_PREREQUISITE');
  flow.sideVisitId = v.id;
  newCheckpoint(s, group, 'side');
}
export function acceptPlacement(s: ProgressState, supply: Supply) {
  const p = ensureEntry(s).placement;
  if (
    p?.kind !== 'formal_route' &&
    p?.kind !== 'resume_course' &&
    p?.kind !== 'engine_action'
  )
    throw new Error('NO_FORMAL_PLACEMENT');
  const program = p.startProgramId ?? s.profile.currentProgramId;
  if (!program) throw new Error('NO_PLACEMENT_PROGRAM');
  s.profile = engine.switchProgram(s.profile, program, supply.curriculum);
  const position = s.profile.programs[program];
  if (position.suspendedInstance && !s.profile.activeInstance) {
    s.profile.activeInstance = position.suspendedInstance;
    position.suspendedInstance = null;
  }
  s.studyMode = 'recommended';
  s.route = { source: 'recommended', routeId: program, version: 1 };
  s.onboarding.setupStatus = 'completed';
}
export { beginEntryCheck };

export function retestEntry(s: ProgressState, supply: Supply) {
  const flow = ensureEntry(s);
  if (s.profile.activeInstance || flow.suspendedInstance)
    throw new Error('FINISH_ENTRY_TASK_FIRST');
  if (flow.resumeCheckpointId) {
    const cp = flow.checkpoints.find((c) => c.id === flow.resumeCheckpointId);
    if (!cp) throw new Error('NO_RESUME_CHECKPOINT');
    s.onboarding.checkpointId = cp.id;
    s.onboarding.currentCheckpointGroup = cp.groupId;
    s.onboarding.checkpointPurpose = cp.purpose;
    s.onboarding.screen = 'entry_checkpoint';
    flow.resumeCheckpointId = null;
    flow.practice = null;
    return;
  }
  const group =
    flow.placement?.pendingCheckpoint ?? s.onboarding.currentCheckpointGroup;
  if (!group || !Object.hasOwn(supply.registry.groups, group))
    throw new Error('NO_RETEST_GROUP');
  if (!flow.access.passed || !s.onboarding.questionnaire.companionAvailable)
    throw new Error('COMPANION_REQUIRED');
  newCheckpoint(s, group, s.onboarding.checkpointPurpose ?? 'initial');
}

export function pauseEntryReport(s: ProgressState, supply: Supply) {
  if (
    s.profile.activeInstance ||
    !s.profile.currentVisit ||
    s.profile.currentVisit.actions < s.profile.currentVisit.budget
  )
    throw new Error('ENTRY_BUDGET_NOT_REACHED');
  const cp = checkpoint(s);
  ensureEntry(s).resumeCheckpointId = cp.id;
  resolveEntry(s, supply, true);
}
