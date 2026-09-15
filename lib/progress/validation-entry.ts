import type { ProgressState, Supply } from '../curriculum/types.js';
import type { TaskInstance } from '../curriculum/contracts.js';
import { demand, object, natural, strings } from '../curriculum/loader.js';
import { entryPlanner } from '../curriculum/entry-planner.js';
export function validateEntry(
  s: ProgressState,
  supply: Supply,
  active: (v: unknown) => void,
) {
  const flow = s.onboarding.entry;
  if (!flow) {
    demand(s.studyMode !== 'entry', 'entry runtime missing');
    return;
  }
  demand(
    object(flow) &&
      object(flow.access) &&
      natural(flow.access.attempts) &&
      flow.access.attempts <= 2 &&
      typeof flow.access.passed === 'boolean' &&
      Array.isArray(flow.checkpoints) &&
      flow.checkpoints.length <= 1000,
    'entry runtime',
  );
  demand(
    flow.access.passed === false || flow.access.attempts > 0,
    'entry access observation',
  );
  demand(
    flow.sideVisitId === null || typeof flow.sideVisitId === 'string',
    'entry side visit',
  );
  active(flow.suspendedInstance);
  if (s.studyMode === 'entry')
    demand(
      flow.suspendedInstance === null && s.route?.routeId === 'onboarding',
      'selected entry',
    );
  const ids = new Set<string>(),
    instances = new Set<string>();
  if (flow.resumeCheckpointId !== undefined && flow.resumeCheckpointId !== null)
    demand(
      flow.checkpoints.some((c) => c.id === flow.resumeCheckpointId),
      'entry resume checkpoint',
    );
  for (const cp of flow.checkpoints) {
    demand(
      object(cp) &&
        typeof cp.id === 'string' &&
        !ids.has(cp.id) &&
        Object.hasOwn(supply.registry.groups, cp.groupId) &&
        ['initial', 'prerequisite', 'side'].includes(cp.purpose) &&
        object(cp.metadata) &&
        Array.isArray(cp.observations) &&
        typeof cp.confirmed === 'boolean',
      'entry checkpoint',
    );
    ids.add(cp.id);
    for (const [id, m] of Object.entries(cp.metadata)) {
      demand(
        object(m) &&
          m.purpose === 'entry_probe' &&
          m.groupId === cp.groupId &&
          m.instanceId === id &&
          !instances.has(id) &&
          supply.registry.groups[cp.groupId].orderedItemIds.includes(
            m.itemId,
          ) &&
          m.contentHash === supply.curriculum.items[m.itemId].contentHash,
        'entry metadata identity',
      );
      instances.add(id);
      for (const key of [
        'independentAccess',
        'promptFree',
        'novelTargetBeforeShow',
        'freshPassageBeforeShow',
        'familiarBeforeShow',
        'companionObserved',
        'onlyMemorised',
      ] as const)
        demand(typeof m[key] === 'boolean', 'entry metadata ' + key);
      const instance =
        s.profile.attempts.find((a) => a.instanceId === id) ??
        (s.profile.activeInstance?.instanceId === id
          ? s.profile.activeInstance
          : null) ??
        (flow.suspendedInstance?.instanceId === id
          ? flow.suspendedInstance
          : null);
      demand(
        instance &&
          instance.itemId === m.itemId &&
          instance.mode === 'read' &&
          instance.context === 'free' &&
          instance.phase === 'free' &&
          instance.programId === null &&
          instance.nodeId === null,
        'entry metadata instance',
      );
      demand(
        s.sourceEvents.some(
          (e) =>
            e.source === 'entry' &&
            e.kind === 'launch' &&
            e.instanceId === id &&
            e.entryCheckpointId === cp.id,
        ),
        'entry metadata source',
      );
      const observation = cp.observations.filter((o) => o.instanceId === id);
      if (s.profile.receipts[id]) {
        const attempt = s.profile.attempts.find((a) => a.instanceId === id)!;
        demand(
          observation.length === 1 &&
            JSON.stringify(observation[0]) ===
              JSON.stringify(
                entryPlanner.evaluateAttempt(
                  supply.registry,
                  cp.groupId,
                  attempt,
                  m,
                ),
              ),
          'entry observation grading',
        );
      } else demand(observation.length === 0, 'unfinished entry observation');
    }
    demand(
      cp.observations.every((o) => Object.hasOwn(cp.metadata, o.instanceId)),
      'orphan entry observation',
    );
    if (cp.confirmed) {
      const status = entryPlanner.groupStatus(
        supply.registry,
        cp.groupId,
        cp.observations,
      );
      demand(
        status.status === 'pass' && status.canConfirm === true,
        'entry confirmation evidence',
      );
      const skill = supply.registry.groups[cp.groupId].skillId;
      demand(
        s.profile.confirmedSkills.includes(skill),
        'entry confirmed skill missing',
      );
    }
  }
  if (s.onboarding.checkpointId !== null) {
    const cp = flow.checkpoints.find((c) => c.id === s.onboarding.checkpointId);
    demand(
      cp &&
        cp.groupId === s.onboarding.currentCheckpointGroup &&
        cp.purpose === s.onboarding.checkpointPurpose,
      'selected checkpoint',
    );
  }
  const practice = flow.practice;
  if (practice) {
    const plan = practice.plan;
    demand(
      typeof practice.id === 'string' &&
        object(plan) &&
        plan.kind === 'provisional_free' &&
        natural(practice.position) &&
        strings(plan.orderedTaskIds) &&
        practice.position <= plan.orderedTaskIds.length &&
        plan.orderedTaskIds.length <= 3 &&
        strings(practice.completedInstanceIds) &&
        practice.completedInstanceIds.length === practice.position &&
        plan.startNodeId === null &&
        plan.startEpisodeId === null &&
        plan.advanceCourse === false,
      'entry practice',
    );
    const g = supply.registry.groups[plan.entryRetestGroup];
    demand(
      g &&
        JSON.stringify(g.orderedItemIds.slice(0, 3)) ===
          JSON.stringify(plan.orderedTaskIds),
      'entry practice source',
    );
    demand(
      ['read', 'listen'].includes(plan.mode) &&
        plan.orderedTaskIds.every((id) =>
          supply.curriculum.items[id].allowedModes.includes(plan.mode),
        ),
      'entry practice mode',
    );
    for (let i = 0; i < practice.position; i++) {
      const id = practice.completedInstanceIds[i],
        a = s.profile.attempts.find((a) => a.instanceId === id);
      demand(
        a?.itemId === plan.orderedTaskIds[i] &&
          a.mode === plan.mode &&
          a.context === 'free' &&
          s.sourceEvents.some(
            (e) =>
              e.source === 'entry' &&
              e.kind === 'launch' &&
              e.instanceId === id &&
              e.entryPracticeId === practice.id &&
              e.entryPosition === i,
          ),
        'entry practice completed order',
      );
    }
  }
  const check = (instance: TaskInstance | null) => {
    if (!instance) return;
    demand(
      instance.context === 'free' &&
        instance.phase === 'free' &&
        instance.programId === null &&
        instance.nodeId === null &&
        instance.episodeId === null &&
        instance.stepId === null,
      'entry active context',
    );
    if (practice) {
      demand(
        instance.itemId === practice.plan.orderedTaskIds[practice.position] &&
          instance.mode === practice.plan.mode &&
          s.sourceEvents.some(
            (e) =>
              e.source === 'entry' &&
              e.kind === 'launch' &&
              e.instanceId === instance.instanceId &&
              e.entryPracticeId === practice.id &&
              e.entryPosition === practice.position,
          ),
        'entry active practice',
      );
    } else {
      const cp = flow.checkpoints.find(
        (c) => c.id === s.onboarding.checkpointId,
      );
      demand(
        cp && Object.hasOwn(cp.metadata, instance.instanceId),
        'entry active checkpoint',
      );
    }
  };
  check(flow.suspendedInstance);
  if (s.studyMode === 'entry') check(s.profile.activeInstance);
  if (flow.placement !== null) {
    demand(
      object(flow.placement) &&
        [
          'access_setup',
          'scope_complete',
          'provisional_free',
          'side_support',
          'entry_checkpoint_needed',
          'entry_checkpoint_unavailable',
          'engine_gate',
          'engine_action',
          'formal_route',
          'resume_course',
        ].includes(flow.placement.kind) &&
        !('profileToPersist' in flow.placement),
      'entry placement',
    );
  }
}
