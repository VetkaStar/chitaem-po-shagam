import { interestLabel } from './interest-labels.js';
export interface RoadmapInterestsProps {
  tags: string[];
  selected: string[];
  busy: boolean;
  onChange: (tags: string[]) => void;
}
export default function RoadmapInterests({
  tags,
  selected,
  busy,
  onChange,
}: RoadmapInterestsProps) {
  return (
    <details className="curriculum-companion">
      <summary>Интересы</summary>
      <p>
        Интересы помогают подобрать тему из доступных материалов. Проверки
        навыка от них не меняются.
      </p>
      <div className="curriculum-options">
        {tags.map((tag) => (
          <label key={tag}>
            <input
              type="checkbox"
              checked={selected.includes(tag)}
              disabled={busy}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...new Set([...selected, tag])]
                    : selected.filter((value) => value !== tag),
                )
              }
            />
            {interestLabel(tag)}
          </label>
        ))}
      </div>
      {selected.some((tag) => !tags.includes(tag)) && (
        <p>Некоторые сохранённые интересы пока не представлены в материалах.</p>
      )}
    </details>
  );
}
