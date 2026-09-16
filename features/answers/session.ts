import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { trainerItems } from '../trainers/catalog';
import { fitsTopic } from '../../lib/topic-material';
import { nextTrainerTask } from '../trainers/session-actions';

export function answerItems(supply: Supply, unit: number) {
  return trainerItems(supply, 'choice', 'words').filter(
    (task) =>
      fitsTopic(task.requiredLetters ?? '', unit) &&
      fitsTopic(task.learnerText, unit),
  );
}
export async function openAnswer(
  controller: CurriculumController,
  supply: Supply,
  unit: number,
  length: number,
  fresh = false,
) {
  const prefix = `answer:words:${unit}:`;
  const saved = controller.snapshot();
  let route = fresh
    ? undefined
    : Object.values(saved.customRoutes)
        .filter(
          (item) =>
            item.routeId.startsWith(prefix) &&
            item.position < item.steps.length,
        )
        .at(-1);
  if (!route) {
    const pool = answerItems(supply, unit);
    if (!pool.length) return null;
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const id = prefix + crypto.randomUUID();
    route = {
      source: 'custom' as const,
      routeId: id,
      version: 1,
      position: 0,
      suspendedInstance: null,
      steps: pool.slice(0, Math.max(1, length)).map((task, index) => ({
        id: `${id}:${index}`,
        itemId: task.id,
        mode: 'read' as const,
      })),
    };
    await controller.registerCustomRoute(route);
  }
  await controller.selectCustomRoute(route.routeId);
  await nextAnswer(controller);
  return route.routeId;
}
export async function nextAnswer(controller: CurriculumController) {
  await nextTrainerTask(controller, 7);
  const view = controller.visible();
  if (view?.kind === 'task' && !view.optionsRevealed)
    await controller.revealOptions();
}
