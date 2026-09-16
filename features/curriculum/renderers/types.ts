import type {
  RawResponse,
  ReadingProof,
} from '../../../lib/curriculum/contracts.js';
import type { TaskPresentation } from '../presentation.js';
export interface TaskRendererProps {
  task: TaskPresentation;
  busy: boolean;
  compactAudio?: boolean;
  compactControls?: boolean;
  compositionPlaceholder?: string;
  submitLabel?: string;
  onSubmit: (response: RawResponse) => Promise<void>;
  onReading: (reading?: ReadingProof) => Promise<void>;
  onReveal: () => Promise<void>;
  onSpeak?: (questionId: string | null, optionId: string | null) => void;
}
