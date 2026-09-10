import { readingTexts, type TextKind } from '../content/reading-library';
import { topicTexts } from '../content/topic-texts';
import { levels } from './learning';
import { fitsTopic } from './topic-material';
export function textsForTopic(kind: TextKind, unit: number) {
  const eligible = [...topicTexts, ...readingTexts].filter(
    (t) =>
      t.kind === kind &&
      t.lines.every((line) => fitsTopic(line, unit)) &&
      t.options.every((option) => fitsTopic(option, unit)),
  );
  const unlocked = (t: (typeof eligible)[number]) =>
    levels.findIndex(
      (_, i) =>
        t.lines.every((line) => fitsTopic(line, i)) &&
        t.options.every((option) => fitsTopic(option, i)),
    );
  const latest = Math.max(0, ...eligible.map(unlocked));
  return eligible.filter((t) => unlocked(t) >= Math.max(0, latest - 2));
}
