import { Check, HelpCircle, RotateCcw, Volume2 } from 'lucide-react';
export default function FeedbackMessage({
  kind,
  text,
  sound,
  speaking = false,
  speak,
}: {
  kind: string;
  text: string;
  sound: boolean;
  speaking?: boolean;
  speak: (text: string) => void;
}) {
  return (
    <div className={'feedback ' + kind} role="status" aria-live="polite">
      {sound && (
        <button
          className="speak-button"
          aria-label="Озвучить объяснение"
          title="Озвучить объяснение"
          disabled={speaking}
          onClick={() => speak(text)}
        >
          <Volume2 size={18} />
        </button>
      )}
      {kind === 'success' ? (
        <Check size={19} />
      ) : kind === 'error' ? (
        <RotateCcw size={19} />
      ) : kind === 'uncertain' ? (
        <HelpCircle size={19} />
      ) : null}
      <span>{text}</span>
    </div>
  );
}
