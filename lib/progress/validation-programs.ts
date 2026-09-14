import type { Profile } from '../curriculum/contracts.js';
import type { Curriculum } from '../curriculum/types.js';
import { demand, object, strings, own } from '../curriculum/loader.js';
import { catalogChecks, isText } from './validation-helpers.js';
export function validatePrograms(
  p: Profile,
  c: Curriculum,
  active: (value: unknown) => void,
) {
  const { node, item } = catalogChecks(c);
  for (const [id, position] of Object.entries(p.programs)) {
    const raw = position as unknown as Record<string, unknown>,
      manifest = c.programs.find((x) => x.id === id)!;
    demand(
      position.version === manifest.version && isText(position.stage),
      'position version/stage',
    );
    demand(
      position.nodeId === (manifest.defaultPath[position.cursor] ?? null),
      'cursor/node mismatch',
    );
    for (const key of ['completedNodes', 'provisionalNodes'])
      demand(
        strings(raw[key]) &&
          (raw[key] as string[]).every((x) => manifest.nodeIds.includes(x)),
        key,
      );
    demand(strings(position.completedSteps), 'completedSteps');
    const nodeEpisodes = position.nodeId
      ? c.nodes[position.nodeId].episodeIds
      : [];
    demand(position.episodeIndex <= nodeEpisodes.length, 'episodeIndex range');
    if (position.teachingOrder == null) {
      const ep = c.episodes[nodeEpisodes[position.episodeIndex]];
      demand(
        ep ? position.stepIndex < ep.steps.length : position.stepIndex === 0,
        'stepIndex range',
      );
    }
    if (position.teachingOrder != null) {
      const n = position.nodeId && c.nodes[position.nodeId];
      demand(
        n &&
          strings(position.teachingOrder) &&
          position.teachingOrder.length === n.episodeIds.length &&
          new Set(position.teachingOrder).size ===
            position.teachingOrder.length &&
          position.teachingOrder.every((x) => n.episodeIds.includes(x)),
        'teachingOrder',
      );
      demand(
        position.episodeIndex <= position.teachingOrder.length,
        'episodeIndex',
      );
      const ep = c.episodes[position.teachingOrder[position.episodeIndex]];
      demand(
        ep ? position.stepIndex < ep.steps.length : position.stepIndex === 0,
        'stepIndex',
      );
    }
    if (position.suspendedInstance !== null) {
      active(position.suspendedInstance);
      demand(position.suspendedInstance.programId === id, 'suspended owner');
    }
    for (const key of ['activeInfo', 'pendingAction', 'suspendedPlan']) {
      const a = raw[key];
      if (a == null) continue;
      demand(object(a) && isText(a.kind) && isText(a.planId), 'saved action');
      if (a.nodeId != null)
        demand(
          node(a.nodeId) && c.nodes[a.nodeId as string].programId === id,
          'saved action node',
        );
      if (a.episodeId != null) {
        demand(
          typeof a.episodeId === 'string' && own(c.episodes, a.episodeId),
          'saved action episode',
        );
        const ep = c.episodes[a.episodeId];
        demand(
          ep.nodeId === position.nodeId && ep.programId === id,
          'saved action episode owner',
        );
        const order = position.teachingOrder ?? nodeEpisodes;
        demand(
          order[position.episodeIndex] === ep.id &&
            ep.steps[position.stepIndex]?.id === a.stepId,
          'saved action cursor',
        );
      }
      if (a.itemId != null) demand(item(a.itemId), 'saved action item');
      if (key === 'activeInfo')
        demand(
          ['episode_info', 'context_info', 'correction_info'].includes(a.kind),
          'information kind',
        );
    }
  }
}
