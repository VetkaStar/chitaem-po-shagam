import type { Supply } from '../../lib/curriculum/types';
import type { CurriculumController } from '../curriculum/controller';
import { trainerItems } from './catalog';
import { fitsTopic } from '../../lib/topic-material';
import { nextTrainerTask } from './session-actions';
import type { Mode } from '../../lib/curriculum/contracts';
import type { TrainerId } from './catalog';
import type { TrainerSection } from './task-section';
export function trainerRoutePrefix(
  kind: TrainerId,
  section: TrainerSection,
  unit: number,
  mode: Mode,
) {
  return section === 'syllables' && mode === 'read'
    ? `syllable-parts:${kind}:${unit}:`
    : `lesson-trainer:${section}:${kind}:${unit}:${mode}:`;
}
export function lessonTrainerItems(
  supply: Supply,
  kind: TrainerId,
  section: TrainerSection,
  unit: number,
  mode: Mode = 'read',
) {
  return trainerItems(supply, kind, section).filter(
    (task) =>
      task.allowedModes.includes(mode) &&
      fitsTopic(task.requiredLetters ?? '', unit) &&
      fitsTopic(task.learnerText, unit) &&
      task.options.every((option) => fitsTopic(option.text, unit)),
  );
}
export async function openTrainerLesson(
  controller: CurriculumController,
  supply: Supply,
  kind: TrainerId,
  section: TrainerSection,
  unit: number,
  length: number,
  fresh = false,
  mode: Mode = 'read',
) {
  const pool = lessonTrainerItems(supply, kind, section, unit, mode);
  const ids = new Set(pool.map((task) => task.id));
  const prefix = trainerRoutePrefix(kind, section, unit, mode);
  let route = fresh
    ? undefined
    : Object.values(controller.snapshot().customRoutes)
        .filter(
          (route) =>
            (route.routeId.startsWith(prefix) ||
              route.routeId.startsWith(`trainer:${kind}:`)) &&
            route.steps.every(
              (step) => ids.has(step.itemId) && step.mode === mode,
            ),
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
        mode,
      })),
    };
    await controller.registerCustomRoute(route);
  }
  await controller.selectCustomRoute(route.routeId);
  await nextTrainerTask(controller, 7);
  return route.routeId;
}
