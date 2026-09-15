type Method = 'p1' | 'p2';
type Comfort = 'comfortable' | 'needs_help' | 'unsure';
interface Props {
  method: Method | null;
  comfort: Comfort | null;
  completed: boolean;
  busy: boolean;
  onSelect: (method: Method) => void;
  onComfort: (comfort: Comfort) => void;
}
const methods: { id: Method; title: string }[] = [
  { id: 'p1', title: 'По шагам от слогов' },
  { id: 'p2', title: 'От знакомых слов' },
];
const comfortOptions: { value: Comfort; title: string }[] = [
  { value: 'comfortable', title: 'Было удобно' },
  { value: 'needs_help', title: 'Нужна помощь' },
  { value: 'unsure', title: 'Пока не знаю' },
];
export function DemoControls({
  method,
  comfort,
  completed,
  busy,
  onSelect,
  onComfort,
}: Props) {
  return (
    <section
      className="curriculum-companion"
      aria-label="Знакомство с методами"
    >
      <h2>Знакомство с методами</h2>
      <p>
        Можно попробовать оба способа. Это знакомство, а не проверка навыков.
        Приложение не выбирает лучший метод автоматически.
      </p>
      <div className="curriculum-actions">
        {methods.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={busy}
            aria-pressed={method === option.id}
            onClick={() => onSelect(option.id)}
          >
            Попробовать: {option.title}
          </button>
        ))}
      </div>
      {method && completed && (
        <fieldset disabled={busy} className="curriculum-answer-form">
          <legend>Как было заниматься этим способом?</legend>
          <div className="curriculum-actions">
            {comfortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={busy}
                aria-pressed={comfort === option.value}
                onClick={() => onComfort(option.value)}
              >
                {option.title}
              </button>
            ))}
          </div>
          {comfort && (
            <p className="curriculum-saved-answer" role="status">
              Твоё впечатление сохранено.
            </p>
          )}
        </fieldset>
      )}
    </section>
  );
}
