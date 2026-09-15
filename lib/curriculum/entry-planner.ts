import * as source from './vendor/entry_planner.mjs';
import type { Profile } from './contracts.js';
import type { Supply, Questionnaire } from './types.js';
import type {
  EntryMetadata,
  EntryObservation,
  EntryStatus,
  EntryProbe,
  EntryPlacement,
  EntryPractice,
} from './entry-types.js';
export interface NormalisedAnswers extends Questionnaire {
  initialGroup: string;
  sideGroups: string[];
  program: string;
  budget: 3 | 5 | 7;
  interestTags?: string[];
  skipAssessment?: boolean;
}
interface Planner {
  normaliseAnswers(q: Questionnaire): NormalisedAnswers;
  accessDecision(q: Questionnaire): 'OK' | 'ACCESS_NEEDED';
  selectProbe(
    r: Supply['registry'],
    p: Profile,
    group: string,
    state?: { usedItemIds?: string[] },
  ): EntryProbe;
  evaluateAttempt(
    r: Supply['registry'],
    group: string,
    a: Profile['attempts'][number],
    m: EntryMetadata,
  ): EntryObservation;
  groupStatus(
    r: Supply['registry'],
    group: string,
    observations: EntryObservation[],
  ): EntryStatus;
  confirmEligibleGroups(
    p: Profile,
    c: Supply['curriculum'],
    r: Supply['registry'],
    obs: EntryObservation[],
    id: string,
  ): { profile: Profile; applied: string[] };
  chooseGoal(
    r: Supply['registry'],
    q: Questionnaire,
    group: string,
    status: EntryStatus,
    statuses: Record<string, EntryStatus>,
  ): { groupId: string | null; reason: string };
  resolvePlacement(
    c: Supply['curriculum'],
    r: Supply['registry'],
    p: Profile,
    q: Questionnaire,
    target: string | null,
    statuses: Record<string, EntryStatus>,
    probeState?: Record<string, unknown>,
  ): EntryPlacement;
  practicePlan(
    c: Supply['curriculum'],
    r: Supply['registry'],
    group: string,
    q: Questionnaire,
    reason: string,
  ): EntryPractice;
}
export const entryPlanner = source as unknown as Planner;
