import { belowSpeechThreshold } from '../../lib/speech/ctc-score';
import { startLocalSpeech } from '../../lib/local-speech';
import { narratorUtterance } from '../../lib/narrator-utterance';
import { speakPiper, stopPiperSpeech } from '../../lib/piper-speech';
import type { Settings } from '../lesson/config';

export type EntrySpeechResult = {
  transcript: string;
  isFinal: true;
  confidence?: number;
  error?: string;
};
type RecognitionOptions = {
  lang?: string;
  onReady?: () => void;
  onStatus?: (status: string) => void;
};
type MediaSettings = Pick<Settings, 'voice' | 'slow' | 'sound' | 'micDevice'> &
  Partial<Pick<Settings, 'speechModel' | 'micProcessing' | 'narrator' | 'narrationRate' | 'speechConfidenceThreshold'>>;
const aborted = () => Object.assign(new Error('ABORTED'), { code: 'ABORTED' });

/** Called only from explicit speech/record buttons. No transcript is persisted. */
export function createEntryMedia(
  getSettings: () => MediaSettings,
  startSpeech: typeof startLocalSpeech = startLocalSpeech,
) {
  let cancelSpeech: (() => void) | undefined;
  let capture:
    | {
        stop: () => void;
        finish: () => void;
      }
    | undefined;
  const stopSpeech = () => {
    const cancel = cancelSpeech;
    cancelSpeech = undefined;
    cancel?.();
  };
  const stopRecognition = () => {
    const previous = capture;
    capture = undefined;
    previous?.stop();
  };
  return {
    get voiceSupported() {
      return (
        typeof window !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia &&
        'AudioContext' in window
      );
    },
    stopSpeech,
    stopRecognition,
    finishRecognition() {
      capture?.finish();
    },
    speak(text: string, _options?: { lang?: string }): Promise<void> {
      stopRecognition();
      stopSpeech();
      if (!getSettings().sound)
        return Promise.reject(new Error('sound-disabled'));
      if (getSettings().narrator && getSettings().narrator !== 'system') {
        window.speechSynthesis?.cancel();
        return new Promise((resolve, reject) => {
          let settled = false;
          const settle = (error?: Error) => {
            if (settled) return;
            settled = true;
            if (cancelSpeech === cancel) cancelSpeech = undefined;
            if (error) reject(error);
            else resolve();
          };
          const cancel = () => {
            stopPiperSpeech();
            settle(aborted());
          };
          cancelSpeech = cancel;
          speakPiper(text, {
            slow: getSettings().slow,
            rate: getSettings().narrationRate,
            narrator: getSettings().narrator,
            onEnd: () => settle(),
            onError: settle,
          });
        });
      }
      stopPiperSpeech();
      if (typeof window === 'undefined' || !('speechSynthesis' in window))
        return Promise.reject(new Error('speech-unavailable'));
      const utterance = narratorUtterance(text, getSettings());
      if (!utterance) return Promise.reject(new Error('voice-unavailable'));
      speechSynthesis.cancel();
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (error?: Error) => {
          if (settled) return;
          settled = true;
          if (cancelSpeech === cancel) cancelSpeech = undefined;
          utterance.onend = utterance.onerror = null;
          if (error) reject(error);
          else resolve();
        };
        const cancel = () => {
          settle(aborted());
          speechSynthesis.cancel();
        };
        cancelSpeech = cancel;
        utterance.onend = () => settle();
        utterance.onerror = () => settle(new Error('speech-failed'));
        try {
          speechSynthesis.speak(utterance);
        } catch {
          settle(new Error('speech-failed'));
        }
      });
    },
    recognize(options: RecognitionOptions = {}): Promise<EntrySpeechResult> {
      stopSpeech();
      stopRecognition();
      return new Promise((resolve, reject) => {
        let settled = false,
          finishing = false;
        const parts: string[] = [];
        const confidence: number[] = [];
        let engine: ReturnType<typeof startLocalSpeech> | undefined;
        const settle = (result?: EntrySpeechResult) => {
          if (settled) return;
          settled = true;
          if (capture === token) capture = undefined;
          engine?.abort();
          parts.length = confidence.length = 0;
          if (result) resolve(result);
          else reject(aborted());
        };
        const token = {
          stop: () => settle(),
          finish: () => {
            if (settled || finishing) return;
            finishing = true;
            void engine
              ?.finish()
              .then(() => {
                if (settled) return;
                const transcript = parts.join(' ').trim();
                settle({
                  transcript,
                  isFinal: true,
                  ...(confidence.length
                    ? { confidence: Math.min(...confidence) }
                    : {}),
                  ...(!transcript ? { error: 'no_speech' } : {}),
                });
              })
              .catch(() => {
                if (!settled)
                  settle({
                    transcript: '',
                    isFinal: true,
                    error: 'service_unavailable',
                  });
              });
          },
        };
        capture = token;
        try {
          engine = startSpeech({
            deviceId: getSettings().micDevice || undefined,
            speechModel: getSettings().speechModel,
            micProcessing: getSettings().micProcessing,
            speechConfidenceThreshold: getSettings().speechConfidenceThreshold,
            onLevel: () => {},
            onStatus: (text) => {
              if (!settled) options.onStatus?.(text);
            },
            onReady: () => {
              if (!settled) options.onReady?.();
            },
            onPartial: () => {},
            onResult: (result) => {
              if (settled || !result.text?.trim()) return;
              if (result.model?.startsWith('gigaam-ctc') && belowSpeechThreshold(result.confidenceScore, getSettings().speechConfidenceThreshold)) return;
              parts.push(result.text.trim());
              // Experimental engines have unknown confidence: keep it absent, never invent a score.
              if (!result.experimental) confidence.push(
                result.result?.length
                  ? Math.min(
                      ...result.result.map((word) =>
                        Number.isFinite(word.conf) ? word.conf : 0,
                      ),
                    )
                  : 0,
              );
            },
            onError: (_message, code) => {
              if (!settled)
                settle({
                  transcript: '',
                  isFinal: true,
                  error: code || 'service_unavailable',
                });
            },
          });
          if (settled) engine.abort();
        } catch {
          settle({
            transcript: '',
            isFinal: true,
            error: 'service_unavailable',
          });
        }
      });
    },
  };
}
