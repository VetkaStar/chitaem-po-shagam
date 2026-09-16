import type { Profile } from '../curriculum/contracts';
import type { EntryState } from './types';
import { engine } from '../curriculum/core';
export function entryHistory(profile: Profile) {
  return {
    currentVisitId: profile.currentVisit?.id ?? null,
    promptedTargetsThisVisit: profile.exposures.events
      .filter((e) => e.visitId === profile.currentVisit?.id)
      .flatMap((e) => e.promptedTexts)
      .map((t) =>
        t
          .normalize('NFC')
          .replace(/[\u0300\u0301]/g, '')
          .toUpperCase()
          .replace(/[^А-ЯЁ0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      ),
  };
}
export function mergeEntry(profile: Profile, state: EntryState): Profile {
  let p = structuredClone(profile);
  const previous = p.entry08;
  if (previous?.id === state.id && previous.revision > state.revision)
    throw new Error('STALE_ENTRY');
  if (previous?.id === state.id && previous.revision === state.revision)
    return p;
  if (!p.currentVisit)
    p = engine.beginVisit(p, `entry08:${state.id}:${state.visit.number}`, {
      budget: 5,
    });
  const start =
    previous?.id === state.id ? (previous.syncedExposureCount ?? 0) : 0;
  const cues =
    previous?.id === state.id ? (previous.syncedPromptCount ?? 0) : 0;
  for (const e of state.sourceExposures.slice(start))
    p = engine.commitExposure(p, {
      texts: e.type === 'shown' ? [e.target] : [],
      heardPassages: e.type === 'heard' ? [e.target] : [],
      itemIds: [e.sourceTaskId],
    });
  for (const e of state.prompts.slice(cues))
    p = engine.commitExposure(p, { texts: [], promptedTexts: [e.target] });
  p.entry08 = {
    ...structuredClone(state),
    syncedExposureCount: state.sourceExposures.length,
    syncedPromptCount: state.prompts.length,
  };
  p.revision++;
  return p;
}
