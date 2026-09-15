import type { Profile } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
import { engine } from '../../lib/curriculum/core.js';
import { presentation } from './presentation.js';

/** Resolve only material already disclosed by the saved task stage. */
export function optionAudio(
  profile: Profile,
  supply: Supply,
  instanceId: string,
  questionId: string | null,
  optionId: string | null,
) {
  const view = presentation(profile, supply);
  if (view?.kind !== 'task' || view.instanceId !== instanceId)
    throw new Error('STALE_INSTANCE');
  if (!view.optionsRevealed) throw new Error('OPTIONS_HIDDEN');
  const question =
    questionId === null
      ? null
      : view.questions.find((q) => q.id === questionId);
  if (questionId !== null && !question) throw new Error('UNKNOWN_QUESTION');
  const text =
    optionId === null
      ? question?.prompt
      : (question ? question.options : view.options).find(
          (o) => o.id === optionId,
        )?.text;
  if (!text) throw new Error('UNKNOWN_AUDIO');
  const normal = (value: string) =>
    value.toLocaleLowerCase('ru').replace(/[^а-яёa-z0-9]/g, '');
  const target = normal(view.text);
  // Reading the target itself is help, even when it is also an option.
  let next =
    target && normal(text).includes(target)
      ? engine.requestHelp(profile, supply.curriculum, {
          level: view.mode === 'listen' ? 0 : 1,
          targetAudio: true,
        })
      : profile;
  next = engine.commitExposure(next, { texts: [text] });
  const shown = presentation(next, supply);
  if (shown?.kind === 'task' && shown.hints.length)
    next = engine.commitExposure(next, { texts: shown.hints });
  return { profile: next, text };
}
