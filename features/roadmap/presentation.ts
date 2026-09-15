import { engine } from '../../lib/curriculum/core.js';
import type { ProgressState, Supply } from '../../lib/curriculum/types.js';

export const evidenceLabels: Record<string, string> = {
  learning: 'Пока не подтверждено',
  pending_retention: 'Получилось самостоятельно; устойчивость ещё проверим',
  mastered: 'Освоение подтверждено',
};

export function roadmapPresentation(supply: Supply, state: ProgressState) {
  const { curriculum } = supply;
  const { profile } = state;
  const program = curriculum.programs.find(
    (p) => p.id === profile.currentProgramId,
  );
  const position = program ? profile.programs[program.id] : undefined;
  const node = position?.nodeId ? curriculum.nodes[position.nodeId] : undefined;
  const goals =
    program && position?.nodeId
      ? program.defaultPath
          .slice(position.cursor, position.cursor + 3)
          .map((id) => curriculum.nodes[id])
          .filter((item) => !!item)
          .map((item) => ({
            id: item.id,
            title: item.title,
            status: engine.nodeEvidenceStatus(profile, curriculum, item.id)
              .status,
          }))
      : [];
  const evidence = program
    ? program.nodeIds.map((id) => ({
        id,
        title: curriculum.nodes[id].title,
        status: engine.nodeEvidenceStatus(profile, curriculum, id).status,
      }))
    : [];
  const confirmedEntry = Object.entries(profile.skillBasis)
    .filter(
      ([, basis]) =>
        basis &&
        typeof basis === 'object' &&
        'status' in basis &&
        basis.status === 'confirmed_entry',
    )
    .map(([id]) => {
      const skill = curriculum.skills[id];
      return {
        id,
        title:
          skill &&
          typeof skill === 'object' &&
          'title' in skill &&
          typeof skill.title === 'string'
            ? skill.title
            : 'Проверяемый навык',
      };
    });
  const observations =
    state.onboarding.entry?.checkpoints.flatMap((cp) => cp.observations) ?? [];
  return {
    program,
    node,
    goals,
    evidence,
    confirmedEntry,
    hasPosition: !!position,
    hasActive: !!(
      profile.activeInstance?.context === 'route' ||
      position?.suspendedInstance ||
      position?.activeInfo
    ),
    entryAssisted: observations.filter(
      (observation) => observation.result === 'assisted',
    ).length,
    entryUnassessed: observations.filter(
      (observation) => observation.result === 'unassessed',
    ).length,
    assistedAttempts: profile.attempts.filter(
      (attempt) => attempt.helpLevel > 0,
    ).length,
    uncertainAttempts: profile.attempts.filter(
      (attempt) => attempt.outcome === 'uncertain',
    ).length,
    skippedAttempts: profile.attempts.filter(
      (attempt) => attempt.outcome === 'skipped',
    ).length,
    inputErrors: profile.attempts.filter(
      (attempt) => attempt.outcome === 'input_error',
    ).length,
    tags: [
      ...new Set(
        Object.values(curriculum.items).flatMap((item) => item.interestTags),
      ),
    ].sort(),
  };
}
export type RoadmapView = ReturnType<typeof roadmapPresentation>;
