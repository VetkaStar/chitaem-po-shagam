import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import { routeEngine } from '../../lib/curriculum/core.js';

/** Mutate only a controller-owned draft; persistence and serialization stay in the controller. */
export function park(s: ProgressState) {
  const a = s.profile.activeInstance;
  if (!a) return;
  if (a.context === 'route' && a.programId)
    s.profile.programs[a.programId].suspendedInstance = a;
  else if (s.studyMode === 'custom' && s.route)
    s.customRoutes[s.route.routeId].suspendedInstance = a;
  else s.suspendedFreeInstance = a;
  s.profile.activeInstance = null;
  s.profile.revision++;
}

export function logSource(
  s: ProgressState,
  kind: ProgressState['sourceEvents'][number]['kind'],
  instanceId: string | null,
) {
  s.sourceEvents.push({
    id: crypto.randomUUID(),
    source: s.studyMode,
    routeId: s.studyMode === 'free' ? null : (s.route?.routeId ?? null),
    routeVersion: s.studyMode === 'free' ? null : (s.route?.version ?? null),
    instanceId,
    customStepId:
      s.studyMode === 'custom' && kind === 'launch'
        ? s.customRoutes[s.route!.routeId].steps[
            s.customRoutes[s.route!.routeId].position
          ].id
        : null,
    kind,
  });
}

export function launchFreeProfile(
  s: ProgressState,
  supply: Supply,
  itemId: string,
  mode: string,
  instanceId: string,
) {
  const p = structuredClone(s.profile),
    program = p.currentProgramId;
  // The upstream free context must not own/clear a suspended official-course instance.
  p.currentProgramId = null;
  const next = routeEngine.launchFree(p, supply.curriculum, itemId, {
    mode,
    instanceId,
  });
  next.currentProgramId = program;
  return next;
}
