export type EntryPage =
  | 'role'
  | 'age'
  | 'questions'
  | 'interests'
  | 'access'
  | 'voice'
  | 'mic_trial'
  | 'probe'
  | 'pause'
  | 'report';
export type EntryDispatch = (
  action: string,
  payload?: Record<string, unknown>,
) => void;
export interface EntryQuestion {
  id: string;
  text: string;
  options: [string, string][];
  number?: number;
  total?: number;
}
export interface EntryLearner {
  instanceId?: string;
  instruction: string;
  target?: string;
  type?: string;
  phase?: string;
  helpParts?: string[];
  feedback?: string | null;
  showMicrophone?: boolean;
  options?: { id: string; text: string }[];
  speechIssue?: { message: string; retryable?: boolean } | null;
}
export interface EntryScreensProps {
  page: EntryPage;
  answers: Record<string, unknown>;
  question?: EntryQuestion | null;
  learner?: EntryLearner | null;
  report?: {
    title: string;
    note: string;
    nextGoals: string[];
    strengths?: string[];
  } | null;
  companion?: boolean;
  busy?: boolean;
  error?: string | null;
  capturing?: boolean;
  status?: string | null;
  playingTarget?: boolean;
  played?: boolean;
  accessHint?: boolean;
  dispatch: EntryDispatch;
}
