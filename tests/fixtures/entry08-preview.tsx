import { createRoot } from 'react-dom/client';
import EntryRoot from '../../features/entry08/EntryRoot';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import { IndexedDbProgressStore } from '../../lib/progress/indexed-db';
import { CurriculumController } from '../../features/curriculum/controller';
import { defaults } from '../../features/lesson/config';
import type {
  createEntryMedia,
  EntrySpeechResult,
} from '../../features/entry08/media';
import bank from '../../content/curriculum/lite-bank.json';
import '../../app/globals.css';
async function initialize() {
  const supply = await loadBundledSupply(),
    store = new IndexedDbProgressStore(supply, indexedDB, 'entry08-browser');
  const controller = await CurriculumController.open(
    supply,
    store,
    localStorage,
  );
  let result: EntrySpeechResult = {
      transcript: 'привет',
      isFinal: true,
      confidence: 0.99,
    },
    resolveMic: ((r: EntrySpeechResult) => void) | undefined,
    rejectMic: ((e: Error) => void) | undefined;
  let resolveSound: (() => void) | undefined,
    rejectSound: ((e: Error) => void) | undefined;
  const speech: string[] = [];
  const media: ReturnType<typeof createEntryMedia> = {
    voiceSupported: true,
    speak(text) {
      speech.push(text);
      return new Promise((r, j) => {
        resolveSound = r;
        rejectSound = j;
      });
    },
    stopSpeech() {
      rejectSound?.(new Error('ABORTED'));
      resolveSound = undefined;
      rejectSound = undefined;
    },
    recognize(options) {
      options?.onReady?.();
      return new Promise((r, j) => {
        resolveMic = r;
        rejectMic = j;
      });
    },
    stopRecognition() {
      rejectMic?.(new Error('ABORTED'));
      resolveMic = undefined;
      rejectMic = undefined;
    },
    finishRecognition() {
      resolveMic?.(result);
      resolveMic = undefined;
      rejectMic = undefined;
    },
  };
  Object.assign(window, {
    entryHarness: {
      controller,
      store,
      supply,
      bank,
      speech,
      completeSound: () => {
        resolveSound?.();
        resolveSound = undefined;
        rejectSound = undefined;
      },
      say: (text: string, error?: string) => {
        result = {
          transcript: text,
          isFinal: true,
          confidence: 0.99,
          ...(error ? { error } : {}),
        };
      },
    },
  });
  createRoot(document.getElementById('root')!).render(
    <EntryRoot
      controller={controller}
      supply={supply}
      settings={defaults}
      media={media}
      onExit={() => {
        document.title = 'Exited';
      }}
    />,
  );
}
void initialize().catch((e) =>
  Object.assign(window, { entryError: String(e) }),
);
