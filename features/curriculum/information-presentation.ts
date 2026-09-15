import type { Profile } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
import type { InfoPresentation } from './presentation-types.js';
export function informationPresentation(
  profile: Profile,
  supply: Supply,
): InfoPresentation | null {
  const saved = profile.currentProgramId
    ? (profile.programs[profile.currentProgramId]?.activeInfo as
        | Record<string, unknown>
        | undefined)
    : undefined;
  if (!saved) return null;
  let source: Record<string, unknown>;
  if (saved.kind === 'episode_info') {
    const step = supply.curriculum.episodes[
      String(saved.episodeId)
    ]?.steps.find((s) => s.id === saved.stepId);
    if (!step) throw new Error('INVALID_INFORMATION_STEP');
    source = step as unknown as Record<string, unknown>;
  } else if (saved.kind === 'context_info' || saved.kind === 'correction_info')
    source = saved;
  else throw new Error('UNSUPPORTED_INFORMATION_RENDERER: ' + saved.kind);
  return informationFromSource(source, String(saved.planId), supply);
}
export function informationFromSource(
  source: Record<string, unknown>,
  planId: string,
  supply: Supply,
): InfoPresentation {
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string')
      : [];
  const texts = [
    typeof source.visibleText === 'string' ? source.visibleText : '',
    ...strings(source.chunks),
    ...strings(source.visibleParts),
    ...strings(source.parts),
  ];
  if (
    typeof source.itemId === 'string' &&
    source.showText !== false &&
    !source.fullTextHidden &&
    !source.hideAllParts
  )
    texts.push(supply.curriculum.items[source.itemId].learnerText);
  return {
    kind: 'info',
    planId,
    instruction:
      typeof source.instruction === 'string' ? source.instruction : '',
    texts: [...new Set(texts.filter(Boolean))],
    spokenTexts:
      typeof source.spokenText === 'string' ? [source.spokenText] : [],
  };
}
