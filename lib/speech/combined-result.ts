import { belowSpeechThreshold } from './ctc-score';
export type FinalCandidate = { text: string; model: string; confidenceScore?: number };
/** Both candidates must be final results of the same captured segment. */
export function combineFinals(primary: FinalCandidate, fast: FinalCandidate, threshold = 0) {
  const usable = primary.text.trim() && (!primary.model.startsWith('gigaam-ctc') ||
    !belowSpeechThreshold(primary.confidenceScore, threshold));
  const chosen = usable ? primary : fast.text.trim() ? fast : primary;
  return { ...chosen, decision: usable ? 'primary' as const : chosen === fast ? 'fallback' as const : 'empty' as const,
    candidates: [primary, fast] };
}
