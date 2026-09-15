/** Browser-only fixture. Never imported by static-entry/main or the production bundle. */
import { createRoot } from 'react-dom/client';
import CurriculumSession from '../../features/curriculum/CurriculumSession';
import { CurriculumController } from '../../features/curriculum/controller';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import { createState } from '../../lib/progress/state';
import { engine } from '../../lib/curriculum/core';
import * as route from '../../lib/curriculum/vendor/source/route.mjs';
import type { ProgressState, Supply } from '../../lib/curriculum/types';
import '../../app/globals.css';

type FixtureHarness = {
  controller: CurriculumController;
  supply: Supply;
  spoken: string[];
  exits: number;
  prepare: (episodeId: string) => Promise<void>;
  prepareFree: (itemId: string) => Promise<void>;
  saved: () => Promise<ProgressState | null>;
};
declare global {
  interface Window {
    testHarness: FixtureHarness;
    fixtureError?: string;
  }
}

async function initialize() {
  const supply = await loadBundledSupply();
  const store = new IndexedDbProgressStore(supply, indexedDB, 'stage2-test');
  const controller = await CurriculumController.open(
    supply,
    store,
    localStorage,
  );
  const harness: FixtureHarness = {
    controller,
    supply,
    spoken: [],
    exits: 0,
    saved: () => store.read(),
    async prepareFree(itemId) {
      const item = supply.curriculum.items[itemId];
      if (!item || item.id === 'task.1bb67acaeb41')
        throw new Error('INVALID_FREE_FIXTURE');
      const current = await store.read();
      const state = createState(
        supply,
        localStorage,
        '00000000-0000-4000-8000-000000000003',
      );
      await store.commit(state, current?.storageRevision ?? null);
      const fresh = await CurriculumController.open(
        supply,
        store,
        localStorage,
      );
      await fresh.beginVisit('browser-free-' + itemId, 7);
      await fresh.launchFree(
        itemId,
        item.allowedModes.includes('read') ? 'read' : item.allowedModes[0],
        '00000000-0000-4000-8000-000000000004',
      );
    },
    async prepare(episodeId) {
      const episode = supply.curriculum.episodes[episodeId];
      if (!episode) throw new Error('UNKNOWN_FIXTURE_EPISODE');
      const node = supply.curriculum.nodes[episode.nodeId];
      if (
        episode.purpose === 'demonstration' ||
        !node.episodeIds.includes(episodeId)
      )
        throw new Error('DEMONSTRATIONS_MUST_BE_SELECTED_THROUGH_UI');
      const current = await store.read();
      const state = createState(
        supply,
        localStorage,
        '00000000-0000-4000-8000-000000000002',
      );
      state.profile = engine.switchProgram(
        state.profile,
        episode.programId,
        supply.curriculum,
      );
      // An explicit test position does not grant letters, mastery, or entry evidence.
      state.profile = route.chooseEntry(
        state.profile,
        supply.curriculum,
        episode.nodeId,
      );
      const position = state.profile.programs[episode.programId];
      position.episodeIndex = node.episodeIds.indexOf(episodeId);
      state.studyMode = 'recommended';
      state.route = {
        source: 'recommended',
        routeId: episode.programId,
        version: 1,
      };
      await store.commit(state, current?.storageRevision ?? null);
      // The browser test reloads the whole page after this write: session local state must not be patched.
    },
  };
  window.testHarness = harness;
  document.documentElement.dataset.layout = 'order';
  document.documentElement.dataset.look = 'plain';
  document.documentElement.dataset.paper = 'main';
  createRoot(document.getElementById('root')!).render(
    <div className="app-root calm" data-vision="off" data-audio="off">
      <main className="lesson">
        <CurriculumSession
          controller={controller}
          programs={supply.curriculum.programs.map(({ id, title }) => ({
            id,
            title,
          }))}
          sound={false}
          speak={(text) => {
            harness.spoken.push(text);
          }}
          onExit={() => {
            harness.exits++;
          }}
        />
      </main>
    </div>,
  );
}
initialize().catch((error: unknown) => {
  window.fixtureError = error instanceof Error ? error.message : String(error);
  document.getElementById('root')!.textContent = window.fixtureError;
});
