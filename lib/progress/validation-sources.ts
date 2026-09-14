import type { TaskInstance } from '../curriculum/contracts.js';
import type { CustomRoute, ProgressState } from '../curriculum/types.js';
import { demand } from '../curriculum/loader.js';

/** The launch ledger owns source identity; matching text alone cannot transfer an attempt. */
export function validateSourceOwnership(state: ProgressState) {
  const checkOrigin = (
    instance: TaskInstance,
    source: 'custom' | 'free',
    route?: CustomRoute,
  ) => {
    demand(
      instance.context === 'free' &&
        instance.phase === 'free' &&
        instance.programId === null &&
        instance.nodeId === null &&
        instance.episodeId === null &&
        instance.stepId === null,
      'free instance ownership',
    );
    const launches = state.sourceEvents.filter(
      (event) =>
        event.kind === 'launch' && event.instanceId === instance.instanceId,
    );
    demand(
      launches.length > 0 &&
        launches.every(
          (event) =>
            event.source === source &&
            event.routeId === (route?.routeId ?? null) &&
            event.routeVersion === (route?.version ?? null) &&
            event.customStepId === (route?.steps[route.position]?.id ?? null),
        ),
      'instance source origin',
    );
  };
  const checkCustom = (route: CustomRoute, instance: TaskInstance | null) => {
    if (!instance) return;
    const step = route.steps[route.position];
    demand(
      step && step.itemId === instance.itemId && step.mode === instance.mode,
      'custom instance step mismatch',
    );
    checkOrigin(instance, 'custom', route);
  };
  for (const route of Object.values(state.customRoutes))
    checkCustom(route, route.suspendedInstance);
  if (state.suspendedFreeInstance)
    checkOrigin(state.suspendedFreeInstance, 'free');
  const active = state.profile.activeInstance;
  if (!active) return;
  if (state.studyMode === 'custom') {
    const route = state.customRoutes[state.route!.routeId];
    demand(route.suspendedInstance === null, 'custom route already suspended');
    checkCustom(route, active);
  } else if (state.studyMode === 'free') checkOrigin(active, 'free');
  else demand(active.context === 'route', 'recommended instance ownership');
}
