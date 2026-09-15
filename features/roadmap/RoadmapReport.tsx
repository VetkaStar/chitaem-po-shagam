import type { RoadmapView } from './presentation.js';
export default function RoadmapReport({ view }: { view: RoadmapView }) {
  return (
    <details className="curriculum-companion">
      <summary>Что уже подтверждено</summary>
      {(['mastered', 'pending_retention'] as const).map((status) => {
        const items = view.evidence.filter((item) => item.status === status);
        return (
          <section key={status}>
            <h3>
              {status === 'mastered'
                ? 'Освоение подтверждено'
                : 'Ожидает проверки устойчивости'}
            </h3>
            {items.length ? (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            ) : (
              <p>Пока нет.</p>
            )}
          </section>
        );
      })}
      <h3>Подтверждено при входе</h3>
      {view.confirmedEntry.length ? (
        <ul>
          {view.confirmedEntry.map((item) => (
            <li key={item.id}>{item.title}</li>
          ))}
        </ul>
      ) : (
        <p>Пока нет.</p>
      )}
      <p>Входное подтверждение навыка не означает прохождение курса.</p>
      <h3>С помощью и без оценки</h3>
      <p>
        Входные наблюдения с помощью: {view.entryAssisted}; без оценки:{' '}
        {view.entryUnassessed}.
      </p>
      <p>
        Учебные попытки с зарегистрированной подсказкой: {view.assistedAttempts}
        .
      </p>
      <p>
        Не удалось оценить: {view.uncertainAttempts}; пропущено:{' '}
        {view.skippedAttempts}; ошибки ввода: {view.inputErrors}.
      </p>
      <p>
        Эти наблюдения не являются отметками об освоении. Пропуск и ошибка ввода
        не означают ошибку чтения.
      </p>
    </details>
  );
}
