import type { CurriculumController } from '../curriculum/controller.js';
import type { CustomRoute } from '../../lib/curriculum/types.js';
import type { Mode } from '../../lib/curriculum/contracts.js';
import type { TrainerId } from './catalog.js';
export const trainerRoutePrefix = (id: TrainerId) => `trainer:${id}:`;
/** References only: the shared controller owns all progression and persistence. */
export function createTrainerRoute(
  id: TrainerId,
  itemIds: string[],
  mode: Mode,
): CustomRoute {
  const routeId = trainerRoutePrefix(id) + crypto.randomUUID();
  return {
    source: 'custom',
    routeId,
    version: 1,
    position: 0,
    suspendedInstance: null,
    steps: itemIds.map((itemId, index) => ({
      id: `${routeId}:${index}`,
      itemId,
      mode,
    })),
  };
}
export async function nextTrainerTask(
  controller: CurriculumController,
  budget: 3 | 5 | 7,
) {
  const state = controller.snapshot();
  if (state.profile.activeInstance) return;
  const route =
    state.route?.source === 'custom' && state.customRoutes[state.route.routeId];
  if (!route || route.position >= route.steps.length) return;
  const visit = state.profile.currentVisit;
  if (!visit || visit.actions >= visit.budget) {
    if (visit) await controller.endVisit();
    await controller.beginVisit(crypto.randomUUID(), budget);
  }
  const token = await controller.planNext();
  if (token.kind !== 'custom_task' && token.kind !== 'active_task')
    throw new Error('TRAINER_TASK_UNAVAILABLE');
  await controller.launch(token);
}
