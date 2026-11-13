import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import { browserStorage } from '../../lib/progress/profile-storage';
import { CurriculumController } from '../curriculum/controller';
import { waitForFreeExposure } from '../free-practice/service';
import { syncProfileAge } from '../../lib/entry08/profile-age';

/** Profile editing owns no progress draft: reopen the latest controller revision. */
export async function persistProfileAge(age: string): Promise<void> {
  await waitForFreeExposure();
  const supply = await loadBundledSupply();
  const store = new IndexedDbProgressStore(supply);
  try {
    const controller = await CurriculumController.open(supply, store, browserStorage);
    const state = controller.snapshot();
    const { entry08: entry, entry08Ui: ui, personalPath08 } = state.profile;
    if (!ui) return;
    const personal = entry ? personalPath08?.[entry.id] : undefined;
    const update = syncProfileAge(age, ui, entry, personal?.version === '0.8.1' ? personal : undefined);
    await controller.saveEntry08(state.storageRevision, update);
  } finally {
    await store.close();
  }
}
