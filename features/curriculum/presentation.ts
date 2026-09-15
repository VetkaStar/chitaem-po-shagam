import type { Profile, TaskInstance } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
import type { Presentation } from './presentation-types.js';
import { informationPresentation } from './information-presentation.js';
import { tokenOrder } from './token-order.js';
export type {
  Presentation,
  TaskPresentation,
  InfoPresentation,
} from './presentation-types.js';
/** Only authored prompts and already revealed material cross this boundary. Never send grading keys. */
export function presentation(
  profile: Profile,
  supply: Supply,
): Presentation | null {
  const a = profile.activeInstance as
    | (TaskInstance & { optionsRevealed?: boolean })
    | null;
  if (!a) return informationPresentation(profile, supply);
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
    answerKind: t.answer.kind,
    instruction: step?.instruction ?? t.assistantPrompt,
    taskInstruction: t.assistantPrompt,
    transformFollowup:
      a.context === 'free' &&
      (t as typeof t & { requiresFollowupReading?: boolean })
        .requiresFollowupReading === true,
    transformText: (a as typeof a & { transformText?: string }).transformText,
    text: t.learnerText,
    lines: t.lines ?? t.learnerText.split('\n'),
    mode: a.mode,
    readingStageFinished: a.readingStageFinished === true,
    reading:
      a.reading?.verifier === 'companion'
        ? structuredClone(a.reading)
        : undefined,
    optionsRevealed: optionsVisible,
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
        ? tokenOrder(a, supply).map((id) => {
            const v = t.partTokens?.find((x) => x.tokenId === id);
            if (!v) throw new Error('INVALID_TOKEN_ORDER');
            return { tokenId: v.tokenId, text: v.text };
          })
        : [],
    joiner: t.answer.kind === 'ordered_parts' ? (t.answer.joiner ?? '') : '',
    functionCheck:
      t.answer.kind === 'companion_function'
        ? { capabilityId: t.answer.capabilityId, criterion: t.answer.criterion }
        : null,
    selectedAnswers: structuredClone(a.answers),
    helpLevel: a.helpLevel,
    canRequestHint: t.hints.some(
      (_, i) => (t.hintLevels?.[i] ?? (i === 0 ? 1 : 4)) > a.helpLevel,
    ),
    hints: t.hints.filter(
      (_, i) => (t.hintLevels?.[i] ?? (i === 0 ? 1 : 4)) <= a.helpLevel,
    ),
  };
}
