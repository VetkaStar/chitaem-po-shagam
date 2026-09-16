import type { EntryPage } from '../../features/entry08/entry-screen-types';
import type { PersonalRun } from './personal';
// Extend the host profile without changing the signed upstream contract file.
declare module '../curriculum/contracts' {
  interface Profile {
    entry08?: EntryState;
    entry08Ui?: EntryUi;
    personalPath08?: Record<string, PersonalRun>;
  }
}
export type Answers = Record<string, unknown>;
export interface EntryState {
  version: string;
  id: string;
  revision: number;
  config: {
    respondent: string;
    age: string;
    input: string;
    companion: boolean;
    program: string;
    interests: string[];
    [key: string]: unknown;
  };
  group: string;
  active: null | {
    cardId: string;
    instanceId: string;
    phase: string;
    played: boolean;
    captureId: string | null;
    audio: null | { id: string; scope: string };
    [key: string]: unknown;
  };
  visit: { id: string; number: number; used: number; budget: number };
  total: number;
  totalBudget: number;
  paused: boolean;
  finished: boolean;
  observations: unknown[];
  used: string[];
  prompts: { target: string; visitId: string; kind: string }[];
  sourceExposures: {
    type: string;
    sourceTaskId: string;
    target: string;
    visitId: string;
    instanceId: string;
  }[];
  syncedExposureCount?: number;
  syncedPromptCount?: number;
  [key: string]: unknown;
}
export interface EntryUi {
  version: '0.8.1';
  answers: Answers;
  page: EntryPage | 'lesson';
  accessHint?: boolean;
}
