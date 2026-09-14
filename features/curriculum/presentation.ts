import type { Profile, TaskInstance } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
export interface TaskPresentation {
  kind: 'task';
  instanceId: string;
  taskKind: string;
  instruction: string;
  text: string;
  mode: string;
  readingStageFinished: boolean;
  options: { id: string; text: string }[];
  questions: {
    id: string;
    prompt: string;
    options: { id: string; text: string }[];
  }[];
  tokens: { tokenId: string; text: string }[];
  selectedAnswers: Record<string, string[]>;
  helpLevel: number;
}
export type Presentation =
  | TaskPresentation
  | { kind: 'info'; planId: string; instruction: string; texts: string[] };
/** Whitelist projection: answer, hints, partsAfterAnswer, grading and mastery never enter a renderer. */
export function presentation(
  profile: Profile,
  supply: Supply,
): Presentation | null {
  const a = profile.activeInstance as
    | (TaskInstance & { optionsRevealed?: boolean })
    | null;
  if (a) {
    const t = supply.curriculum.items[a.itemId];
    const optionsVisible = a.optionsRevealed === true;
    const ordered = (key: string, options: { id: string; text: string }[]) =>
      (a.optionOrder[key] ?? []).map((id) => {
        const option = options.find((o) => o.id === id);
        if (!option) throw new Error('INVALID_OPTION_ORDER');
        return { id: option.id, text: option.text };
      });
    const step = a.episodeId
      ? supply.curriculum.episodes[a.episodeId]?.steps.find(
          (s) => s.id === a.stepId,
        )
      : undefined;
    return {
      kind: 'task',
      instanceId: a.instanceId,
      taskKind: t.kind,
      instruction: step?.instruction ?? t.assistantPrompt,
      text: t.learnerText,
      mode: a.mode,
      readingStageFinished: a.readingStageFinished === true,
      options: optionsVisible ? ordered('task', t.options) : [],
      questions:
        optionsVisible && t.answer.kind === 'question_set'
          ? t.answer.questions.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: ordered(q.id, q.options),
            }))
          : [],
      tokens:
        t.kind === 'compose'
          ? (t.partTokens ?? []).map((x) => ({
              tokenId: x.tokenId,
              text: x.text,
            }))
          : [],
      selectedAnswers: structuredClone(a.answers),
      helpLevel: a.helpLevel,
    };
  }
  const info = profile.currentProgramId
    ? profile.programs[profile.currentProgramId]?.activeInfo
    : null;
  if (!info || typeof info !== 'object') return null;
  const saved = info as Record<string, unknown>;
  if (saved.kind !== 'episode_info') {
    // Support/context renderers belong to stage 2; unknown informational steps are never auto-acknowledged.
    throw new Error('UNSUPPORTED_INFORMATION_RENDERER: ' + saved.kind);
  }
  const ep = supply.curriculum.episodes[String(saved.episodeId)];
  const step = ep?.steps.find((x) => x.id === saved.stepId);
  if (!step) throw new Error('INVALID_INFORMATION_STEP');
  const extended = step as typeof step & {
    showText?: boolean;
    visibleParts?: string[];
    parts?: string[];
  };
  const texts = [
    step.visibleText ?? '',
    ...(step.chunks ?? []),
    ...(extended.visibleParts ?? []),
    ...(extended.parts ?? []),
  ];
  if (step.itemId && extended.showText !== false && !step.fullTextHidden)
    texts.push(supply.curriculum.items[step.itemId].learnerText);
  return {
    kind: 'info',
    planId: String(saved.planId),
    instruction: step.instruction,
    texts: texts.filter(Boolean),
  };
}
