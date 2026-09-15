import { useMemo } from 'react';
import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import { evidenceLabels, roadmapPresentation } from './presentation.js';
import RoadmapReport from './RoadmapReport.js';
import RoadmapInterests from './RoadmapInterests.js';

export interface RoadmapProps {
  supply: Supply;
  state: ProgressState;
  busy: boolean;
  onContinue: () => void;
  onProgram: (id: string) => void;
  onSetup: () => void;
  onExit: () => void;
  onInterests?: (tags: string[]) => void;
}
export default function Roadmap({
  supply,
  state,
  busy,
  onContinue,
  onProgram,
  onSetup,
  onExit,
  onInterests,
}: RoadmapProps) {
  const view = useMemo(
    () => roadmapPresentation(supply, state),
    [supply, state],
  );
  return (
    <section
      className="curriculum-session"
      aria-label="Моя учебная дорожка"
      aria-busy={busy}
    >
      <header className="curriculum-session-header">
        <h1>Моя учебная дорожка</h1>
        <button type="button" disabled={busy} onClick={onExit}>
          Все тренажёры
        </button>
      </header>
      <section className="curriculum-step">
        <h2>{view.program?.title ?? 'Выбери учебную программу'}</h2>
        <p>
          {view.node
            ? `Сохранённый шаг: ${view.node.title}`
            : view.hasPosition
              ? 'Учебные шаги пройдены. При продолжении проверим, нужны ли ещё проверки устойчивости.'
              : 'Можно настроить дорожку или сразу заниматься в любом тренажёре.'}
        </p>
        <div className="curriculum-actions">
          {view.hasPosition && (
            <button type="button" disabled={busy} onClick={onContinue}>
              {view.hasActive ? 'Продолжить задание' : 'Продолжить программу'}
            </button>
          )}
          <button type="button" disabled={busy} onClick={onSetup}>
            Вернуться к настройке
          </button>
        </div>
        <fieldset disabled={busy}>
          <legend>Учебная программа</legend>
          <div className="curriculum-options">
            {supply.curriculum.programs.map((program) => (
              <button
                type="button"
                key={program.id}
                aria-pressed={program.id === state.profile.currentProgramId}
                onClick={() => onProgram(program.id)}
              >
                {program.title}
              </button>
            ))}
          </div>
          <p>
            В каждой программе сохраняется своё место. Выбор программы сам по
            себе не подтверждает навык.
          </p>
        </fieldset>
        <h2>Ближайшие цели</h2>
        <p>
          Это ориентиры по выбранной программе. Следующий доступный шаг
          определяется при продолжении занятия.
        </p>
        {view.goals.length ? (
          <ol className="curriculum-questions">
            {view.goals.map((goal) => (
              <li key={goal.id}>
                <strong>{goal.title}</strong>
                <p>{evidenceLabels[goal.status] ?? 'Пока не подтверждено'}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>Новые цели пока не назначены.</p>
        )}
        <RoadmapReport view={view} />
        {onInterests && (
          <RoadmapInterests
            tags={view.tags}
            selected={state.profile.interests}
            busy={busy}
            onChange={onInterests}
          />
        )}
        <p>
          Все семь разделов тренажёров доступны независимо от дорожки.
          Самостоятельное составление дорожки добавим позже.
        </p>
      </section>
    </section>
  );
}
