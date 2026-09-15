import type {
  Action,
  DemoMethod,
  ProgressState,
  Supply,
} from '../../lib/curriculum/types.js';
import { engine } from '../../lib/curriculum/core.js';
import { informationFromSource } from './information-presentation.js';

import { demoEpisode } from '../../lib/curriculum/demonstrations.js';
export { demoEpisode };
export function currentDemo(s: ProgressState, supply: Supply) {
  if (s.studyMode !== 'demonstration' || !s.route)
    throw new Error('NO_DEMONSTRATION');
  const method = s.route.routeId as DemoMethod;
  const run = s.demonstrationRuns?.[method];
  if (!run) throw new Error('NO_DEMONSTRATION_RUN');
  const episode = demoEpisode(supply, method);
  return { run, episode, step: episode.steps[run.position] };
}
export function demoInformation(s: ProgressState, supply: Supply) {
  const { run, step } = currentDemo(s, supply);
  return run.activeInfo && step
    ? informationFromSource(
        step as unknown as Record<string, unknown>,
        run.activeInfo,
        supply,
      )
    : null;
}
export function planDemonstration(s: ProgressState, supply: Supply): Action {
  const { run, episode, step } = currentDemo(s, supply),
    p = s.profile;
  if (p.activeInstance) return { kind: 'active_task' };
  if (run.activeInfo) return { kind: 'active_info' };
  if (!step) return { kind: 'demonstration_complete' };
  if (!p.currentVisit) return { kind: 'begin_visit' };
  if (p.currentVisit.actions >= p.currentVisit.budget) return { kind: 'pause' };
  if (
    !['task', 'show_chunks', 'model_blend', 'meaning_anchor'].includes(
      step.action,
    )
  )
    throw new Error('UNSUPPORTED_DEMONSTRATION_STEP');
  return {
    kind: step.action === 'task' ? 'demonstration_task' : 'demonstration_info',
    planId: [
      s.route!.routeId,
      run.position,
      p.revision,
      p.currentVisit.id,
    ].join(':'),
    episodeId: episode.id,
    stepId: step.id,
    itemId: step.itemId,
    mode: step.mode,
    instruction: step.instruction,
  };
}
export function launchDemonstration(
  s: ProgressState,
  supply: Supply,
  action: Action,
  instanceId: string,
) {
  const { run, episode, step } = currentDemo(s, supply);
  if (!step || planDemonstration(s, supply).planId !== action.planId)
    throw new Error('STALE_DEMONSTRATION_PLAN');
  if (step.action === 'task') {
    const p = structuredClone(s.profile),
      program = p.currentProgramId;
    p.currentProgramId = null;
    s.profile = engine.presentTask(p, supply.curriculum, {
      instanceId,
      itemId: step.itemId!,
      nodeId: null,
      phase: 'demo',
      context: 'demo',
      episodeId: episode.id,
      stepId: step.id,
      mode: step.mode,
    });
    s.profile.currentProgramId = program;
    s.profile = engine.commitExposure(s.profile, {
      texts: [
        step.instruction,
        supply.curriculum.items[step.itemId!].assistantPrompt,
      ],
    });
  } else {
    const view = informationFromSource(
      step as unknown as Record<string, unknown>,
      action.planId!,
      supply,
    );
    const source = step as unknown as { promptLevel?: number };
    s.profile = engine.commitExposure(s.profile, {
      texts: [...view.texts, view.instruction],
      promptedTexts: (source.promptLevel ?? 0) >= 2 ? view.texts : [],
    });
    s.profile.currentVisit!.actions++;
    s.profile.revision++;
    run.activeInfo = action.planId!;
  }
}
export function acknowledgeDemonstration(
  s: ProgressState,
  supply: Supply,
  planId: string,
) {
  const { run } = currentDemo(s, supply);
  if (!run.activeInfo || run.activeInfo !== planId)
    throw new Error('STALE_DEMONSTRATION_INFO');
  run.activeInfo = null;
  run.position++;
  s.profile.revision++;
}
