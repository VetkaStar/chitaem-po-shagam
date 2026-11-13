import type {
  Action,
  ProgressState,
  Supply,
} from '../../lib/curriculum/types.js';
import { routeEngine } from '../../lib/curriculum/core.js';
export interface SelectedAction {
  profile: ProgressState['profile'];
  action: Action;
}
/** Selection is separate from execution. No selector receives a storage writer or renderer. */
export interface ActionSource {
  source: 'recommended' | 'custom';
  select(state: Readonly<ProgressState>, supply: Supply): SelectedAction;
}
export const recommendedSource: ActionSource = {
  source: 'recommended',
  select: (state, supply) =>
    routeEngine.nextAction(state.profile, supply.curriculum),
};
/** Reserved adapter for authored/custom sequences. This is not an editor or official assessment. */
export const customSource: ActionSource = {
  source: 'custom',
  select(state) {
    if (!state.route || state.route.source !== 'custom')
      throw new Error('NO_CUSTOM_ROUTE');
    const route = state.customRoutes[state.route.routeId];
    if (!route || route.version !== state.route.version)
      throw new Error('CUSTOM_ROUTE_VERSION');
    const step = route.steps[route.position];
    return {
      profile: structuredClone(state.profile),
      action: step
        ? {
            kind: 'custom_task',
            itemId: step.itemId,
            mode: step.mode,
            stepId: step.id,
            planId: [
              route.routeId,
              route.version,
              route.position,
              state.profile.revision,
            ].join(':'),
          }
        : { kind: 'custom_complete' },
    };
  },
};
