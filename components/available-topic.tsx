import { topicNames } from '../lib/topics';

/** An explicit choice: never silently introduce letters from a later topic. */
export default function AvailableTopic({ available, onSelect }: {
  available: number[];
  onSelect: (unit: number) => void;
}) {
  return (
    <div className="exercise empty-topic" role="status">
      <h2>Выберем тему для этого режима</h2>
      <p>В текущей теме таких заданий ещё нет. Можно перейти к теме с готовыми заданиями.</p>
      {available.length ? (
        <div className="curriculum-actions">
          {available.map((unit) => (
            <button key={unit} onClick={() => onSelect(unit)}>{topicNames[unit]}</button>
          ))}
        </div>
      ) : <p>Выбери другой режим в меню занятия.</p>}
    </div>
  );
}
