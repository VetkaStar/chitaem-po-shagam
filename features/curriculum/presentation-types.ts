import type {
  AnswerContract,
  ReadingProof,
} from '../../lib/curriculum/contracts.js';
export interface TaskPresentation {
  kind: 'task';
  instanceId: string;
  taskKind: string;
  instruction: string;
  taskInstruction: string;
  transformFollowup: boolean;
  transformText?: string;
  text: string;
  lines: string[];
  mode: string;
  answerKind: AnswerContract['kind'];
  readingStageFinished: boolean;
  reading?: ReadingProof;
  optionsRevealed: boolean;
  options: { id: string; text: string }[];
  questions: {
    id: string;
    prompt: string;
    options: { id: string; text: string }[];
  }[];
  tokens: { tokenId: string; text: string }[];
  joiner: string;
  selectedAnswers: Record<string, string[]>;
  helpLevel: number;
  hints: string[];
  canRequestHint: boolean;
  canShowIllustration?: boolean;
  illustration?: {
    kind: 'word' | 'story';
    id: string;
    variant: 'main' | 'alternate' | 'context';
  };
  functionCheck: null | { capabilityId: string; criterion: string };
}
export interface InfoPresentation {
  kind: 'info';
  planId: string;
  instruction: string;
  texts: string[];
  spokenTexts: string[];
}
export type Presentation = TaskPresentation | InfoPresentation;
