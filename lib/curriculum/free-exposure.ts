import { normalise } from './vendor/source/normalise.mjs';
import type { Supply } from './types.js';
export interface FreeExposure {
  texts?: string[];
  promptedTexts?: string[];
  heardPassages?: string[];
}
export function exposureInput(supply: Supply, input: FreeExposure) {
  const lists = [
    input.texts ?? [],
    input.promptedTexts ?? [],
    input.heardPassages ?? [],
  ];
  if (
    !lists.every(
      (list) => Array.isArray(list) && list.every((x) => typeof x === 'string'),
    )
  )
    throw new Error('INVALID_EXPOSURE');
  const [texts, promptedTexts, heardPassages] = lists.map((list) => [
    ...new Set(list.filter((x) => x.trim())),
  ]);
  const presented = new Set([...texts, ...heardPassages].map(normalise));
  const items = Object.values(supply.curriculum.items).filter((item) =>
    presented.has(normalise(item.learnerText)),
  );
  return {
    texts,
    promptedTexts,
    heardPassages,
    itemIds: items.map((item) => item.id),
    familyIds: [
      ...new Set(items.map((item) => item.exposureFamily).filter(Boolean)),
    ],
  };
}
