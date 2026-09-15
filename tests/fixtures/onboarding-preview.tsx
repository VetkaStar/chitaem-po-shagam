import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import OnboardingRoot from '../../features/onboarding/OnboardingRoot';
import { CurriculumController } from '../../features/curriculum/controller';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import { createState } from '../../lib/progress/state';
import type { ProgressState, Supply } from '../../lib/curriculum/types';
import '../../app/globals.css';

type OnboardingHarness = {
  controller: CurriculumController;
  supply: Supply;
  spoken: string[];
  exits: number;
  reset: () => Promise<void>;
  saved: () => Promise<ProgressState | null>;
};
declare global {
  interface Window {
    onboardingHarness: OnboardingHarness;
    onboardingFixtureError?: string;
  }
}

async function initialize() {
  const supply = await loadBundledSupply();
  const store = new IndexedDbProgressStore(
    supply,
    indexedDB,
    'stage4-onboarding-test',
  );
  const controller = await CurriculumController.open(
    supply,
    store,
    localStorage,
  );
  const harness: OnboardingHarness = {
    controller,
    supply,
    spoken: [],
    exits: 0,
    saved: () => store.read(),
    async reset() {
      const previous = await store.read();
      // A new test profile only: no reported or fabricated reading evidence.
      const state = createState(
        supply,
        localStorage,
        '00000000-0000-4000-8000-000000000040',
      );
      await store.commit(state, previous?.storageRevision ?? null);
    },
  };
  window.onboardingHarness = harness;
  document.documentElement.dataset.layout = 'order';
  document.documentElement.dataset.look = 'plain';
  document.documentElement.dataset.paper = 'main';
  function Fixture() {
    const [catalog, setCatalog] = useState(false);
    return (
      <div className="app-root calm" data-vision="off" data-audio="off">
        <main className="lesson">
          {catalog ? (
            <section aria-label="Каталог тренажёров">
              <h1>Все тренажёры</h1>
            </section>
          ) : (
            <OnboardingRoot
              controller={controller}
              supply={supply}
              sound={false}
              speak={(text) => harness.spoken.push(text)}
              onExit={() => {
                harness.exits++;
                setCatalog(true);
              }}
            />
          )}
        </main>
      </div>
    );
  }
  createRoot(document.getElementById('root')!).render(<Fixture />);
}
initialize().catch((error: unknown) => {
  window.onboardingFixtureError =
    error instanceof Error ? error.message : String(error);
  document.getElementById('root')!.textContent = window.onboardingFixtureError;
});
