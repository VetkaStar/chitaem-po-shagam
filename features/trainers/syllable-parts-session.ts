import type { Supply } from '../../lib/curriculum/types';
import type { CurriculumController } from '../curriculum/controller';
import { trainerItems } from './catalog';
import { fitsTopic } from '../../lib/topic-material';
import { nextTrainerTask } from './session-actions';
export type SyllablePartsKind = 'compose' | 'find_part';
export function syllablePartsItems(
  supply: Supply,
  kind: SyllablePartsKind,
  unit: number,
) {
  return trainerItems(supply, kind, 'syllables').filter(
    (task) =>
      fitsTopic(task.requiredLetters ?? '', unit) &&
      fitsTopic(task.learnerText, unit) &&
      task.options.every((option) => fitsTopic(option.text, unit)),
  );
}
export async function openSyllableParts(
  controller: CurriculumController,
  supply: Supply,
  kind: SyllablePartsKind,
  unit: number,
  length: number,
  fresh = false,
) {
  const pool = syllablePartsItems(supply, kind, unit);
  const ids = new Set(pool.map((task) => task.id));
  const prefix = `syllable-parts:${kind}:${unit}:`;
  let route = fresh
    ? undefined
    : Object.values(controller.snapshot().customRoutes)
        .filter(
          (route) =>
            (route.routeId.startsWith(prefix) ||
              route.routeId.startsWith(`trainer:${kind}:`)) &&
            route.steps.every((step) => ids.has(step.itemId)),
        )
        .at(-1);
  if (route && route.position >= route.steps.length) route = undefined;
  if (!route) {
    if (!pool.length) return null;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const routeId = prefix + crypto.randomUUID();
    route = {
      source: 'custom' as const,
      routeId,
      version: 1,
      position: 0,
      suspendedInstance: null,
      steps: pool.slice(0, Math.max(1, length)).map((task, index) => ({
        id: `${routeId}:${index}`,
        itemId: task.id,
        mode: 'read' as const,
      })),
    };
    await controller.registerCustomRoute(route);
  }
  await controller.selectCustomRoute(route.routeId);
  await nextTrainerTask(controller, 7);
  return route.routeId;
}
