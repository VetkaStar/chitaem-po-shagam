import { stableShuffle } from '../../lib/curriculum/vendor/source/normalise.mjs';
import type { TaskInstance } from '../../lib/curriculum/contracts.js';
import type { Supply } from '../../lib/curriculum/types.js';
export function tokenOrder(instance: TaskInstance, supply: Supply): string[] {
  const saved = (instance as TaskInstance & { tokenOrder?: string[] })
    .tokenOrder;
  return (
    saved ??
    (stableShuffle(
      (supply.curriculum.items[instance.itemId].partTokens ?? []).map(
        (t) => t.tokenId,
      ),
      instance.instanceId + ':tokens',
    ) as string[])
  );
}
export function preparePresentation(
  profile: { activeInstance: TaskInstance | null },
  supply: Supply,
) {
  const instance = profile.activeInstance;
  if (instance && supply.curriculum.items[instance.itemId].kind === 'compose')
    (instance as TaskInstance & { tokenOrder?: string[] }).tokenOrder =
      tokenOrder(instance, supply);
}
