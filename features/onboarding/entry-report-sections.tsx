import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import type {
  EntryCheckpoint,
  EntryPlacement,
} from '../../lib/curriculum/entry-types.js';
import { entryPlanner } from '../../lib/curriculum/entry-planner.js';
import {
  groupTitle,
  skillTitle,
  placementNotes,
} from './entry-report-labels.js';
export function Observations({
  state,
  supply,
}: {
  state: ProgressState;
  supply: Supply;
}) {
  const latest = new Map<string, EntryCheckpoint>();
  for (const checkpoint of state.onboarding.entry?.checkpoints ?? [])
    latest.set(checkpoint.groupId, checkpoint);
  const confirmed = Object.entries(state.profile.skillBasis).filter(
    ([, basis]) =>
      basis &&
      typeof basis === 'object' &&
      'status' in basis &&
      basis.status === 'confirmed_entry',
  );
  return (
    <section
      className="curriculum-companion"
      aria-label="Наблюдения входной проверки"
    >
      <h2>Что наблюдали в заданиях</h2>
      {!latest.size ? (
        <p>Наблюдений пока нет.</p>
      ) : (
        <ul className="curriculum-selection">
          {[...latest.values()].map((checkpoint) => {
            const result = entryPlanner.groupStatus(
              supply.registry,
              checkpoint.groupId,
              checkpoint.observations,
            );
            const counts = (kind: string) =>
              checkpoint.observations.filter(
                (observation) => observation.result === kind,
              ).length;
            const label =
              result.status === 'pending'
                ? 'Проверка ещё не завершена'
                : result.status === 'needs_teaching'
                  ? 'Нужна учебная поддержка'
                  : result.status === 'mixed'
                    ? 'Смешанные результаты'
                    : 'Получены успешные наблюдения';
            return (
              <li key={checkpoint.id}>
                <strong>{groupTitle(supply, checkpoint.groupId)}</strong>:{' '}
                {label}.
                <p>
                  Верно: {counts('pass')}; с ошибками: {counts('fail')}; с
                  помощью: {counts('assisted')}; без оценки:{' '}
                  {counts('unassessed')}.
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <h2>Подтверждено при входе</h2>
      {confirmed.length ? (
        <ul className="curriculum-selection">
          {confirmed.map(([id]) => (
            <li key={id}>{skillTitle(supply, id)}</li>
          ))}
        </ul>
      ) : (
        <p>Подтверждённых входных навыков пока нет.</p>
      )}
      <p>
        Входное подтверждение относится к проверенному навыку. Это не отметка об
        освоении курса. Ответы с помощью и без оценки указаны отдельно.
      </p>
    </section>
  );
}
export function PlacementDetails({
  placement,
  supply,
}: {
  placement: EntryPlacement;
  supply: Supply;
}) {
  const source =
    placement.kind === 'provisional_free'
      ? placement
      : (placement.practice ?? placement);
  const node = (id: unknown) =>
    typeof id === 'string' ? supply.curriculum.nodes[id]?.title : undefined;
  return (
    <section
      className="curriculum-companion"
      aria-label="Следующий учебный шаг"
    >
      <h2>Что можно делать дальше</h2>
      <p>
        {placementNotes[placement.kind] ??
          'Решение ещё требует отдельного шага настройки. Продолжение программы пока не назначено.'}
      </p>
      <dl>
        {node(placement.recommendedNodeId) && (
          <>
            <dt>Рекомендованная цель</dt>
            <dd>{node(placement.recommendedNodeId)}</dd>
          </>
        )}
        {node(source.sourceNodeId) && (
          <>
            <dt>Источник материала для практики</dt>
            <dd>{node(source.sourceNodeId)}</dd>
          </>
        )}

        <dt>Фактический старт программы</dt>
        <dd>
          {node(placement.startNodeId) ??
            (placement.kind === 'resume_course'
              ? 'С сохранённого задания'
              : placement.kind === 'engine_action'
                ? 'По сохранённому состоянию программы'
                : 'Пока не назначен')}
        </dd>
      </dl>
    </section>
  );
}
