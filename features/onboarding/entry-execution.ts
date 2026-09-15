import type {
  Action,
  ProgressState,
  Supply,
} from '../../lib/curriculum/types.js';
import type { EntryMetadata } from '../../lib/curriculum/entry-types.js';
import { entryPlanner } from '../../lib/curriculum/entry-planner.js';
import { engine } from '../../lib/curriculum/core.js';
import {
  normalise,
  words,
} from '../../lib/curriculum/vendor/source/normalise.mjs';
import { checkpoint, ensureEntry } from './entry-state.js';
import { launchFreeProfile } from '../curriculum/state-transitions.js';

export function planEntry(s: ProgressState, supply: Supply): Action {
  const flow = ensureEntry(s),
    p = s.profile;
  if (p.activeInstance) return { kind: 'active_task' };
  if (
    flow.practice &&
    flow.practice.position >= flow.practice.plan.orderedTaskIds.length
  )
    return { kind: 'entry_practice_complete' };
  if (s.onboarding.screen !== 'entry_checkpoint' && !flow.practice)
    return { kind: 'entry_setup' };
  if (!p.currentVisit) return { kind: 'begin_visit' };
  if (p.currentVisit.actions >= p.currentVisit.budget) return { kind: 'pause' };
  if (flow.practice)
    return {
      kind: 'entry_practice',
      itemId: flow.practice.plan.orderedTaskIds[flow.practice.position],
      mode: flow.practice.plan.mode,
      planId: [flow.practice.id, flow.practice.position, p.revision].join(':'),
    };
  const cp = checkpoint(s),
    status = entryPlanner.groupStatus(
      supply.registry,
      cp.groupId,
      cp.observations,
    );
  if (status.status !== 'pending') return { kind: 'entry_group_result' };
  if (
    cp.observations.slice(-2).length === 2 &&
    cp.observations
      .slice(-2)
      .every((o) => ['uncertain', 'input_error'].includes(o.reason))
  )
    return { kind: 'entry_deferred' };
  const probe = entryPlanner.selectProbe(supply.registry, p, cp.groupId, {
    usedItemIds: Object.values(cp.metadata).map((m) => m.itemId),
  });
  flow.lastProbe = probe;
  return probe.kind === 'probe'
    ? {
        kind: 'entry_task',
        itemId: probe.itemId,
        mode: 'read',
        planId: [cp.id, p.revision, probe.itemId].join(':'),
      }
    : { kind: 'entry_unavailable', reason: probe.reason };
}
export function launchEntry(
  s: ProgressState,
  supply: Supply,
  a: Action,
  instanceId: string,
  observed: boolean,
) {
  const p = s.profile,
    flow = ensureEntry(s);
  if (
    !['entry_task', 'entry_practice'].includes(a.kind) ||
    typeof observed !== 'boolean'
  )
    throw new Error('INVALID_ENTRY_LAUNCH');
  if (
    a.kind === 'entry_task' &&
    (!flow.access.passed ||
      entryPlanner.accessDecision(s.onboarding.questionnaire) !== 'OK')
  )
    throw new Error('UI_ACCESS_REQUIRED');
  if (a.kind === 'entry_task') {
    const cp = checkpoint(s),
      t = supply.curriculum.items[a.itemId!],
      canonical = normalise(t.learnerText);
    const targets = t.targetWords ?? words(t.learnerText);
    const metadata: EntryMetadata = {
      purpose: 'entry_probe',
      groupId: cp.groupId,
      instanceId,
      itemId: t.id,
      contentHash: t.contentHash,
      independentAccess: flow.access.passed,
      promptFree: !engine.wasTargetPromptedThisVisit(p, t.learnerText),
      novelTargetBeforeShow: targets.every(
        (w: string) => !p.exposures.words.includes(normalise(w)),
      ),
      freshPassageBeforeShow:
        !p.exposures.stimuli.includes(canonical) &&
        !p.exposures.heardPassages.includes(canonical) &&
        !p.exposures.families.includes(t.exposureFamily),
      familiarBeforeShow: p.exposures.words.includes(canonical),
      companionObserved:
        observed && s.onboarding.questionnaire.companionAvailable === true,
      onlyMemorised: false,
    };
    cp.metadata[instanceId] = metadata;
  }
  s.profile = launchFreeProfile(s, supply, a.itemId!, a.mode!, instanceId);
  s.profile=engine.commitExposure(s.profile,{texts:[supply.curriculum.items[a.itemId!].assistantPrompt]});
}
export function recordEntryCompletion(
  s: ProgressState,
  supply: Supply,
  instanceId: string,
) {
  if (!s.profile.receipts[instanceId]) return;
  const flow = ensureEntry(s);
  if (flow.practice) {
    flow.practice.completedInstanceIds.push(instanceId);
    flow.practice.position++;
    return;
  }
  const cp = checkpoint(s),
    attempt = s.profile.attempts.find((a) => a.instanceId === instanceId)!;
  cp.observations.push(
    entryPlanner.evaluateAttempt(
      supply.registry,
      cp.groupId,
      attempt,
      cp.metadata[instanceId],
    ),
  );
}
