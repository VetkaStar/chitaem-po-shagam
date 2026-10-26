import type { CurriculumController } from '../curriculum/controller.js';
import type { CustomRoute, ProgressState } from '../../lib/curriculum/types.js';
import type { Mode } from '../../lib/curriculum/contracts.js';
import type { TrainerId } from './catalog.js';
export const trainerRoutePrefix = (id: TrainerId) => `trainer:${id}:`;

export function routeOffset(route: CustomRoute) {
  return Number(route.routeId.match(/:offset-(\d+):/)?.[1] ?? 0);
}

/** Retry keeps stable step IDs, so receipts and one-time rewards survive reloads. */
export async function repeatTrainerTask(controller: CurriculumController, route: CustomRoute, position: number) {
  const root = route.routeId.split(':retry:')[0];
  const routeId = `${root}:retry:${crypto.randomUUID()}:offset-${routeOffset(route) + position}:`;
  await controller.registerCustomRoute({ ...route, routeId, position: 0,
    suspendedInstance: null, steps: route.steps.slice(position) });
  await controller.selectCustomRoute(routeId);
  await nextTrainerTask(controller, 7);
  return routeId;
}

export function stepWasCorrect(state: ProgressState, stepId: string, exceptInstance?: string) {
  return state.sourceEvents.some((event) => event.kind === 'launch' &&
    event.customStepId === stepId && event.instanceId && event.instanceId !== exceptInstance &&
    state.profile.receipts[event.instanceId]?.outcome === 'correct');
}

export function routeResults(state: ProgressState, route: CustomRoute) {
  const original = state.customRoutes[route.routeId.split(':retry:')[0]] ?? route;
  const ids = new Set(original.steps.map((step) => step.id));
  const results = new Map<string, string>();
  for (const event of state.sourceEvents) {
    if (event.kind !== 'launch' || !event.customStepId || !ids.has(event.customStepId) || !event.instanceId) continue;
    const receipt = state.profile.receipts[event.instanceId];
    if (receipt && results.get(event.customStepId) !== 'correct') results.set(event.customStepId, receipt.outcome);
  }
  const values = [...results.values()];
  return { correct: values.filter((value) => value === 'correct').length,
    skipped: values.filter((value) => value === 'skipped').length,
    practice: values.filter((value) => value !== 'correct' && value !== 'skipped').length };
}
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
