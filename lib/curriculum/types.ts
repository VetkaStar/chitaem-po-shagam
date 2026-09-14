import type {
  Profile,
  Task,
  Node,
  Episode,
  ProgramManifest,
  TaskInstance,
} from './contracts.js';
export type { Profile, Task, Node, Episode, ProgramManifest };
export interface Curriculum {
  schemaVersion: '2.0.0';
  contentVersion: '0.7.0';
  programs: ProgramManifest[];
  items: Record<string, Task>;
  nodes: Record<string, Node>;
  episodes: Record<string, Episode>;
  skills: Record<string, unknown>;
  capabilitySupports: Record<string, unknown>;
  taskSets: Record<string, unknown>;
  [key: string]: unknown;
}
export interface EntryRegistry {
  specVersion: 'onboarding-0.7.3';
  curriculumVersion: '0.7.0';
  curriculumSchemaVersion: '2.0.0';
  curriculumSha256: string;
  groups: Record<
    string,
    {
      id: string;
      skillId: string;
      orderedItemIds: string[];
      successNextGroup: string | null;
    }
  >;
}
export interface Supply {
  curriculum: Curriculum;
  registry: EntryRegistry;
}
export interface RuntimeInstance extends TaskInstance {
  optionsRevealed?: boolean;
  promptFreeAtPresentation: boolean;
}
export interface Action {
  kind: string;
  planId?: string;
  basedOnRevision?: number;
  itemId?: string;
  nodeId?: string;
  episodeId?: string;
  stepId?: string;
  instruction?: string;
  mode?: 'read' | 'listen' | 'shared';
  [key: string]: unknown;
}
export interface RouteReference {
  source: 'recommended' | 'custom';
  routeId: string;
  version: number;
}
export interface CustomRoute extends RouteReference {
  source: 'custom';
  steps: { id: string; itemId: string; mode: 'read' | 'listen' | 'shared' }[];
  position: number;
  suspendedInstance: TaskInstance | null;
}
export interface Questionnaire {
  respondent: 'learner' | 'adult' | 'together' | null;
  ageBand: 'under_6' | '6_7' | '8_12' | '13_17' | '18_plus' | null;
  reads:
    | (
        | 'letters'
        | 'syllables'
        | 'short_words'
        | 'multi_part'
        | 'sentences'
        | 'texts'
      )[]
    | null;
  blendingDifficulty: 'often' | 'sometimes' | 'never' | null;
  companionAvailable: boolean | null;
  program: string | null;
  budget: 3 | 5 | 7 | null;
  interests: string[];
}
export interface Onboarding {
  schemaVersion: 1;
  specVersion: 'onboarding-0.7.3';
  curriculumSha256: string;
  setupStatus: 'not_started' | 'deferred' | 'in_progress' | 'completed';
  screen:
    | 'questionnaire'
    | 'access_setup'
    | 'entry_checkpoint'
    | 'placement_report';
  questionnaireStep: keyof Questionnaire | null;
  questionnaire: Questionnaire;
  checkpointId: string | null;
  checkpointPurpose: 'initial' | 'prerequisite' | 'side' | null;
  currentCheckpointGroup: string | null;
  rootGoalGroup: string | null;
  returnToNodeId: string | null;
  deferredGroups: string[];
  sideQueue: string[];
}
export interface SourceEvent {
  customStepId: string | null;
  id: string;
  source: 'free' | 'recommended' | 'custom';
  routeId: string | null;
  routeVersion: number | null;
  instanceId: string | null;
  kind:
    | 'launch'
    | 'answer'
    | 'help'
    | 'reading'
    | 'options'
    | 'info'
    | 'free_exposure';
}
export interface ProgressState {
  schemaVersion: 2;
  storageRevision: number;
  supply: {
    curriculumVersion: '0.7.0';
    curriculumSha256: string;
    specVersion: 'onboarding-0.7.3';
  };
  profile: Profile;
  onboarding: Onboarding;
  studyMode: 'free' | 'recommended' | 'custom';
  route: RouteReference | null;
  customRoutes: Record<string, CustomRoute>;
  suspendedFreeInstance: TaskInstance | null;
  legacy: { capturedAt: string; values: Record<string, string | null> };
  sourceEvents: SourceEvent[];
}
export interface ProgressStore {
  read(): Promise<ProgressState | null>;
  commit(
    next: ProgressState,
    expectedRevision: number | null,
    backupPrevious?: boolean,
  ): Promise<ProgressState>;
}
