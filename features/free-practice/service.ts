import { loadBundledSupply } from '../../lib/curriculum/bundled.js';
import { browserStorage } from '../../lib/progress/profile-storage.js';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db.js';
import { CurriculumController } from '../curriculum/controller.js';
import type { FreeExposure } from '../../lib/curriculum/free-exposure.js';
let tail: Promise<unknown> = Promise.resolve();
/** Finish writes from the screen being left before opening a durable session. */
export async function waitForFreeExposure(): Promise<void> {
  await tail;
}
/** Read the latest revision for each transaction; never own a second long-lived profile. */
export function recordFreeExposure(input: FreeExposure): Promise<void> {
  const operation = tail.then(async () => {
    const supply = await loadBundledSupply();
    const store = new IndexedDbProgressStore(supply);
    try {
      const controller = await CurriculumController.open(
        supply,
        store,
        browserStorage,
      );
      await controller.recordFreeExposure(input);
    } finally {
      await store.close();
    }
  });
  tail = operation.catch(() => undefined);
  return operation;
}
