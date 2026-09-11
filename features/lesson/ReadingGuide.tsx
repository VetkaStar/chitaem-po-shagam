import {
  guideParts,
  letterOffset,
  type ReadingFocus,
} from '@/lib/reading-guide';
import './reading-guide.css';
export default function ReadingGuide({
  text,
  focus,
  highlight,
  progress,
  selected,
  color = false,
  onSelect,
}: {
  text: string;
  focus: ReadingFocus;
  highlight: boolean;
  progress: number;
  selected?: number;
  color?: boolean;
  onSelect: (source: number, text: string) => void;
}) {
  return (
    <span className="reading-guide">
      {guideParts(text, focus).map((part, i) => {
        if (!part.letters) return <span key={i}>{part.text}</span>;
        const start = letterOffset(text, part.start),
          end = letterOffset(text, part.end);
        const current =
          selected !== undefined
            ? part.start === selected
            : start <= progress && progress < end;
        return (
          <button
            type="button"
            key={i}
            className={highlight && current ? 'guide-current' : ''}
            aria-current={current ? 'step' : undefined}
            aria-label={`Читать: ${part.text}`}
            onClick={() => onSelect(part.start, part.text)}
          >
            {color
              ? Array.from(part.text).map((c, j) => (
                  <span
                    key={j}
                    className={
                      /[аеёиоуыэюя]/iu.test(c)
                        ? 'vowel'
                        : /[а-яё]/iu.test(c)
                          ? 'consonant'
                          : ''
                    }
                  >
                    {c}
                  </span>
                ))
              : part.text}
          </button>
        );
      })}
    </span>
  );
}
