import type { Profile, TaskInstance } from './contracts.js';
export interface EntryMetadata {
  purpose: 'entry_probe';
  groupId: string;
  instanceId: string;
  itemId: string;
  contentHash: string;
  independentAccess: boolean;
  promptFree: boolean;
  novelTargetBeforeShow: boolean;
  freshPassageBeforeShow: boolean;
  familiarBeforeShow: boolean;
  companionObserved: boolean;
  onlyMemorised: boolean;
}
export interface EntryObservation {
  groupId: string;
  itemId: string;
  instanceId: string;
  target: string;
  sessionId: string;
  source: 'entry_probe';
  result: 'pass' | 'fail' | 'assisted' | 'unassessed';
  reason: string;
  covers: string[];
  verifiedByCompanion?: boolean;
}
export interface EntryCheckpoint {
  id: string;
  groupId: string;
  purpose: 'initial' | 'prerequisite' | 'side';
  metadata: Record<string, EntryMetadata>;
  observations: EntryObservation[];
  confirmed: boolean;
}
export interface EntryStatus {
  status: 'pending' | 'pass' | 'needs_teaching' | 'mixed';
  proofs: string[];
  canConfirm?: boolean;
  reason?: string;
}
export interface EntryProbe {
  kind: 'probe' | 'probe_unavailable';
  groupId: string;
  itemId?: string;
  reason?: string;
  rejections: { itemId: string; reason: string | null }[];
}
export interface EntryPractice {
  kind: 'provisional_free';
  orderedTaskIds: string[];
  mode: 'read' | 'listen';
  reason: string;
  entryRetestGroup: string;
  selectedProgramId: string;
  sourceNodeId: string;
  sourceEpisodeId: string | null;
  startNodeId: null;
  startEpisodeId: null;
  advanceCourse: false;
  pendingCheckpoint?: string;
  canListen?: boolean;
}
export interface EntryPlacement {
  kind: string;
  reason?: string;
  startProgramId?: string;
  startNodeId?: string | null;
  startEpisodeId?: string | null;
  sourceNodeId?: string;
  sourceEpisodeId?: string | null;
  pendingCheckpoint?: string;
  next?:
    | EntryProbe
    | { kind: string; groupId?: string; [key: string]: unknown };
  practice?: EntryPractice;
  profileToPersist?: Profile;
  orderedTaskIds?: string[];
  mode?: 'read' | 'listen';
  entryRetestGroup?: string;
  selectedProgramId?: string;
  recommendedNodeId?: string;
  [key: string]: unknown;
}
export interface EntryRuntime {
  access: { attempts: number; passed: boolean };
  checkpoints: EntryCheckpoint[];
  placement: EntryPlacement | null;
  suspendedInstance: TaskInstance | null;
  practice: {
    id: string;
    plan: EntryPractice;
    position: number;
    completedInstanceIds: string[];
  } | null;
  lastProbe: EntryProbe | null;
  sideVisitId: string | null;
  resumeCheckpointId?: string | null;
}
