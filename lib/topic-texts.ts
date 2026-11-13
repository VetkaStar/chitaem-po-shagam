import { readingTexts, type TextKind } from '../content/reading-library';
import { topicTexts } from '../content/topic-texts';
import { pilotTexts } from '../content/pilot-texts';
import { levels } from './learning';
import { fitsTopic } from './topic-material';
export function textsForTopic(kind: TextKind, unit: number) {
  const eligible = [...topicTexts, ...readingTexts, ...pilotTexts].filter(
    (t) =>
      t.kind === kind &&
      unit >= (t.minimumUnit ?? 0) &&
      t.lines.every((line) => fitsTopic(line, unit)) &&
      t.options.every((option) => fitsTopic(option, unit)),
  );
  const unlocked = (t: (typeof eligible)[number]) =>
    levels.findIndex(
      (_, i) =>
        i >= (t.minimumUnit ?? 0) &&
        t.lines.every((line) => fitsTopic(line, i)) &&
        t.options.every((option) => fitsTopic(option, i)),
    );
  // New review material must neither disappear nor displace the old selection.
  const latest = Math.max(
    0,
    ...eligible.filter((t) => !t.keepForReview).map(unlocked),
  );
  return eligible.filter(
    (t) => t.keepForReview || unlocked(t) >= Math.max(0, latest - 2),
  );
}
