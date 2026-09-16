import type { TrainerMenuSection } from './navigation';
export default function SectionTrainers({
  section,
  onSelect,
}: {
  section: TrainerMenuSection;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      className="portal-panel"
      aria-label={`Тренажёры раздела ${section.name}`}
    >
      <h1>{section.name}</h1>
      <p>Выбери, как хочешь заниматься.</p>
      <div className="portal-grid">
        {section.items.map((item) => (
          <button
            className="portal-card"
            key={item.id}
            onClick={() => onSelect(item.id)}
          >
            <b>{item.title}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
