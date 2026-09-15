import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import type {
  ReadingProof,
  Submission,
} from '../../lib/curriculum/contracts.js';
import { engine, routeEngine } from '../../lib/curriculum/core.js';

export function applyAnswer(
  s: ProgressState,
  supply: Supply,
  submission: Submission,
) {
  const active = s.profile.activeInstance;
  if (!active || active.instanceId !== submission.instanceId)
    throw new Error('STALE_INSTANCE');
  if (
    active &&
    !submission.disposition &&
    ['passage', 'read_meaning'].includes(
      supply.curriculum.items[active.itemId].kind,
    )
  ) {
    if (
      !active.readingStageFinished ||
      !(active as typeof active & { optionsRevealed?: boolean }).optionsRevealed
    )
      throw new Error('READING_AND_OPTIONS_STAGES_REQUIRED');
  }
  if (
    active &&
    !submission.disposition &&
    supply.curriculum.items[active.itemId].kind === 'transform' &&
    active.context === 'free' &&
    (
      supply.curriculum.items[active.itemId] as {
        requiresFollowupReading?: boolean;
      }
    ).requiresFollowupReading
  ) {
    const draft = active as typeof active & { transformText?: string };
    if (draft.transformText === undefined) {
      if (
        typeof submission.response?.text !== 'string' ||
        !submission.response.text.trim()
      )
        throw new Error('TRANSFORM_TEXT_REQUIRED');
      draft.transformText = submission.response.text;
      s.profile.revision++;
      return;
    }
    if (
      submission.response?.text !== draft.transformText ||
      submission.response.reading?.verifier !== 'companion' ||
      typeof submission.response.reading.correct !== 'boolean'
    )
      throw new Error('TRANSFORM_READING_REQUIRED');
  }
  s.profile = routeEngine.answerAction(
    s.profile,
    supply.curriculum,
    submission,
  );
  if (
    s.studyMode === 'custom' &&
    s.route &&
    s.profile.receipts[submission.instanceId]
  )
    s.customRoutes[s.route.routeId].position++;
}

export function applyReading(
  s: ProgressState,
  supply: Supply,
  instanceId: string,
  reading?: ReadingProof,
) {
  if (
    reading &&
    (reading.verifier !== 'companion' || typeof reading.correct !== 'boolean')
  )
    throw new Error('READING_PROOF_REQUIRED');
  s.profile = engine.recordReadingStage(s.profile, supply.curriculum, {
    instanceId,
    reading,
  });
}

export function applyReveal(s: ProgressState, supply: Supply) {
  const a = s.profile.activeInstance;
  if (!a) throw new Error('NO_ACTIVE_INSTANCE');
  const task = supply.curriculum.items[a.itemId];
  if (
    ['passage', 'read_meaning'].includes(task.kind) &&
    !a.readingStageFinished
  )
    throw new Error('READING_STAGE_REQUIRED');
  s.profile = engine.revealOptions(s.profile, supply.curriculum);
  return a.instanceId;
}
