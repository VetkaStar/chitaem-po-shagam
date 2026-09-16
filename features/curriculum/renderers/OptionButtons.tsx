import { Volume2 } from 'lucide-react';
interface Props {
  compactAudio?: boolean;
  options: { id: string; text: string }[];
  selected: string[];
  busy: boolean;
  onChange: (ids: string[]) => void;
  onSpeak?: (optionId: string) => void;
  audioLabel?: string;
}
export function OptionButtons({
  options,
  selected,
  busy,
  onChange,
  onSpeak,
  audioLabel = '',
  compactAudio = false,
}: Props) {
  return (
    <div className="curriculum-options">
      {options.map((option, index) => (
        <div className="curriculum-option-row" key={option.id}>
          {onSpeak && (
            <button
              type="button"
              className={
                compactAudio
                  ? 'curriculum-option-audio speak-button'
                  : 'curriculum-option-audio'
              }
              disabled={busy}
              aria-label={
                'Послушать вариант ' +
                (index + 1) +
                (audioLabel ? ' ' + audioLabel : '')
              }
              onClick={() => onSpeak(option.id)}
            >
              {compactAudio ? <Volume2 size={18} /> : 'Послушать'}
            </button>
          )}
          <button
            type="button"
            className="curriculum-option"
            disabled={busy}
            aria-pressed={selected.includes(option.id)}
            onClick={() =>
              onChange(
                selected.includes(option.id)
                  ? selected.filter((id) => id !== option.id)
                  : [...selected, option.id],
              )
            }
          >
            {option.text}
          </button>
        </div>
      ))}
    </div>
  );
}
