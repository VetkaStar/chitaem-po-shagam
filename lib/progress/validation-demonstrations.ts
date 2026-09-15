import type { TaskInstance } from '../curriculum/contracts.js';
import type { ProgressState, Supply, DemoMethod } from '../curriculum/types.js';
import { demand, object, natural } from '../curriculum/loader.js';
import { demoEpisode } from '../curriculum/demonstrations.js';
export function validateDemonstrations(
  s: ProgressState,
  supply: Supply,
  active: (v: unknown) => void,
) {
  const runs = s.demonstrationRuns;
  demand(runs === undefined || object(runs), 'demonstration runs');
  if (s.studyMode === 'demonstration')
    demand(
      s.route?.source === 'demonstration' &&
        !!runs?.[s.route.routeId as DemoMethod],
      'selected demonstration',
    );
  const check = (
    instance: TaskInstance,
    method: DemoMethod,
    position: number,
  ) => {
    const episode = demoEpisode(supply, method),
      step = episode.steps[position];
    demand(
      step?.action === 'task' &&
        instance.context === 'demo' &&
        instance.phase === 'demo' &&
        instance.programId === null &&
        instance.nodeId === null &&
        instance.episodeId === episode.id &&
        instance.stepId === step.id &&
        instance.itemId === step.itemId &&
        instance.mode === step.mode,
      'demo instance step',
    );
    const launches = s.sourceEvents.filter(
      (e) => e.kind === 'launch' && e.instanceId === instance.instanceId,
    );
    demand(
      launches.length > 0 &&
        launches.every(
          (e) =>
            e.source === 'demonstration' &&
            e.routeId === method &&
            e.routeVersion === 1 &&
            e.demoStepId === step.id,
        ),
      'demo launch origin',
    );
  };
  for (const [key, run] of Object.entries(runs ?? {})) {
    const episode = demoEpisode(supply, key),
      method = key as DemoMethod;
    demand(
      object(run) &&
        natural(run.position) &&
        run.position <= episode.steps.length &&
        (run.activeInfo === null ||
          (typeof run.activeInfo === 'string' && run.activeInfo.length > 0)) &&
        [null, 'comfortable', 'needs_help', 'unsure'].includes(run.comfort),
      'demo run',
    );
    demand(
      run.comfort === null || run.position === episode.steps.length,
      'unfinished demo comfort',
    );
    active(run.suspendedInstance);
    const selected =
      s.studyMode === 'demonstration' && s.route?.routeId === key;
    const instance = selected
      ? s.profile.activeInstance
      : run.suspendedInstance;
    if (selected)
      demand(run.suspendedInstance === null, 'selected demo suspended');
    if (instance) check(instance, method, run.position);
    const completed = s.sourceEvents.filter(
      (e) =>
        e.source === 'demonstration' &&
        e.routeId === key &&
        e.kind === 'demonstration_step',
    );
    demand(completed.length === run.position, 'demo completed position');
    for (let i = 0; i < run.position; i++) {
      const step = episode.steps[i],
        event = completed[i];
      demand(event.demoStepId === step.id, 'demo completed order');
      if (step.action === 'task') {
        const attempt = s.profile.attempts.find(
          (a) => a.instanceId === event.instanceId,
        );
        demand(
          attempt?.stepId === step.id && attempt.context === 'demo',
          'demo completed receipt',
        );
      } else
        demand(
          event.instanceId === null &&
            typeof event.demoPlanId === 'string' &&
            s.sourceEvents.some(
              (e) =>
                e.source === 'demonstration' &&
                e.kind === 'info' &&
                e.routeId === key &&
                e.demoStepId === step.id &&
                e.demoPlanId === event.demoPlanId,
            ),
          'demo completed information',
        );
    }
    if (run.activeInfo !== null) {
      demand(
        !instance &&
          episode.steps[run.position]?.action !== 'task' &&
          !!episode.steps[run.position],
        'demo information step',
      );
      demand(
        s.sourceEvents.some(
          (e) =>
            e.source === 'demonstration' &&
            e.kind === 'info' &&
            e.routeId === key &&
            e.demoStepId === episode.steps[run.position].id &&
            e.demoPlanId === run.activeInfo,
        ),
        'demo information origin',
      );
    }
  }
  for (const attempt of s.profile.attempts)
    if (attempt.context === 'demo') {
      const method = Object.keys(runs ?? {}).find(
        (m) => demoEpisode(supply, m).id === attempt.episodeId,
      );
      demand(method, 'demo attempt run');
      const index = demoEpisode(supply, method!).steps.findIndex(
        (x) => x.id === attempt.stepId,
      );
      check(attempt, method as DemoMethod, index);
    }
}
