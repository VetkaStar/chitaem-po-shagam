interface Props {
  options: { id: string; text: string }[];
  selected: string[];
  busy: boolean;
  onChange: (ids: string[]) => void;
}
export function OptionButtons({ options, selected, busy, onChange }: Props) {
  return (
    <div className="curriculum-options">
      {options.map((option) => (
        <button
          key={option.id}
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
      ))}
    </div>
  );
}
