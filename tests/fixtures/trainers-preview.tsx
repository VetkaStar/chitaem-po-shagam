import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TrainerSession from '../../features/trainers/TrainerSession';
import {
  trainerDefinitions,
  type TrainerId,
} from '../../features/trainers/catalog';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import { browserStorage } from '../../lib/progress/profile-storage';
import { CurriculumController } from '../../features/curriculum/controller';
import '../../app/globals.css';
async function initialize() {
  const supply = await loadBundledSupply();
  const store = new IndexedDbProgressStore(
    supply,
    indexedDB,
    'standalone-trainer-test',
  );
  let failNext = false;
  const controlledStore = {
    read: () => store.read(),
    commit: (...args: Parameters<typeof store.commit>) => {
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('TEST_SAVE_FAILURE'));
      }
      return store.commit(...args);
    },
  };
  const controller = await CurriculumController.open(
    supply,
    controlledStore,
    browserStorage,
  );
  Object.assign(window, {
    trainersHarness: {
      controller,
      supply,
      failNext: () => {
        failNext = true;
      },
    },
  });
  function Fixture() {
    const [id, setId] = useState<TrainerId | null>(null);
    return id ? (
      <TrainerSession
        key={id}
        trainerId={id}
        controller={controller}
        supply={supply}
        sound={false}
        speak={() => {}}
        onExit={() => setId(null)}
      />
    ) : (
      <nav>
        {trainerDefinitions.map((trainer) => (
          <button key={trainer.id} onClick={() => setId(trainer.id)}>
            {trainer.title}
          </button>
        ))}
      </nav>
    );
  }
  createRoot(document.getElementById('root')!).render(<Fixture />);
}
void initialize().catch((error) =>
  Object.assign(window, { trainersError: String(error) }),
);
