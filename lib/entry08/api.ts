import * as implementation from './vendor/lite-entry.mjs';
import type { EntryState, Answers } from './types';
import type {
  EntryLearner,
  EntryQuestion,
} from '../../features/entry08/entry-screen-types';
type Bank = unknown;
type Change = (
  state: EntryState,
  bank?: Bank,
  payload?: Record<string, unknown>,
) => EntryState;
type Plan = { kind: string; [key: string]: unknown };
export interface AudioEffect {
  text: string;
  instanceId: string;
  audioId: string;
  scope: string;
}
// Typed boundary around the byte-identical supplied pure JavaScript engine.
export const entry = implementation as unknown as {
  createEntry(a: Answers, id: string, history?: unknown): EntryState;
  questionnaireFor(a: Answers): EntryQuestion[];
  upgradeEntry: Change;
  updateInputMode(s: EntryState, b: Bank, input: string): EntryState;
  accessReady(
    s: EntryState,
    options: { voiceAvailable: boolean; voiceOptIn: boolean },
  ): EntryState;
  nextScreen(s: EntryState, b: Bank): Plan;
  openCard(s: EntryState, b: Bank, p: Plan): EntryState;
  learnerView(s: EntryState, b: Bank): EntryLearner | null;
  requestAudio(
    s: EntryState,
    b: Bank,
    p: Record<string, unknown>,
  ): { state: EntryState; effect: AudioEffect };
  finishAudio(s: EntryState, p: Record<string, unknown>): EntryState;
  startCapture(s: EntryState, id: string): EntryState;
  cancelCapture: Change;
  cancelAudio: Change;
  showHint: Change;
  submitSpeech: Change;
  submitCompanion: Change;
  submitChoice: Change;
  skip: Change;
  difficulty: Change;
  next: Change;
  pause: Change;
  resume: Change;
  finishNow: Change;
  speechIssue(code: string): {
    message: string;
    kind: string;
    retryable: boolean;
  };
  report(
    s: EntryState,
    b: Bank,
  ): { title: string; note: string; nextGoals: string[]; strengths: string[] };
};
