import signatures from '../../content/curriculum/legacy-pilot-preparations-v1.json';
import { normalise } from '../curriculum/vendor/source/normalise.mjs';
import { engine } from '../curriculum/core.js';
import { exposureInput } from '../curriculum/free-exposure.js';
import type { ProgressState, Supply } from '../curriculum/types.js';

/** Only the exact old visible-preparation signature is evidence. Audio prompts alone are insufficient. */
export function backfillPilotPreparation(s: ProgressState, supply: Supply) {
  const events = [...s.profile.exposures.events];
  for (const event of events) {
    for (const signature of signatures) {
      const expected = signature.visibleTexts.map(normalise);
      const prompted = [...new Set(event.promptedTexts.map(normalise))];
      if (prompted.length !== expected.length || !expected.every(text => prompted.includes(text))) continue;
      if (expected.every(text => s.profile.exposures.stimuli.includes(text))) continue;
      s.profile = engine.commitExposure(s.profile, exposureInput(supply, { texts: signature.visibleTexts }));
      // Preserve the original visit, not the visit that happened to be open during migration.
      s.profile.exposures.events.at(-1)!.visitId = event.visitId;
    }
  }
}
