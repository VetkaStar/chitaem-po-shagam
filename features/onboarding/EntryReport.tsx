import type { ProgressState, Supply } from '../../lib/curriculum/types.js';
import { readingLabels, groupTitle } from './entry-report-labels.js';
import { Observations, PlacementDetails } from './entry-report-sections.js';
export interface EntryReportProps {
  state: ProgressState;
  supply: Supply;
  busy: boolean;
  onAccept: () => void;
  onPractice: () => void;
  onPrerequisite: () => void;
  onSide: () => void;
  onRetest: () => void;
}
export function EntryReport({
  state,
  supply,
  busy,
  onAccept,
  onPractice,
  onPrerequisite,
  onSide,
  onRetest,
}: EntryReportProps) {
  const { questionnaire, entry, deferredGroups, sideQueue } = state.onboarding;
  const placement = entry?.placement;
  const visit = state.profile.currentVisit,
    sideGroup = sideQueue[0];
  const noActive = !state.profile.activeInstance && !entry?.suspendedInstance;
  const canSide =
    !!sideGroup &&
    noActive &&
    state.onboarding.screen === 'placement_report' &&
    !!visit &&
    visit.budget - visit.actions >= 2 &&
    entry?.sideVisitId !== visit.id &&
    (!['LP_WORD', 'MS_WORD'].includes(sideGroup) ||
      state.profile.confirmedSkills.includes('decode.cv_cv'));
  const canPractice =
    !!placement &&
    (placement.kind === 'provisional_free' ||
      !!placement.practice ||
      placement.kind === 'side_support');
  const tags = new Set(
    Object.values(supply.curriculum.items).flatMap(
      (task) => task.interestTags ?? [],
    ),
  );
  const unavailableInterests = questionnaire.interests.some(
    (tag) => !tags.has(tag),
  );
  return (
    <section
      className="curriculum-session"
      aria-label="Итоги настройки"
      aria-busy={busy}
    >
      <h1>Итоги настройки</h1>
      <section className="curriculum-companion" aria-label="Ответы анкеты">
        <h2>Что вы сообщили</h2>
        <p>
          Чтение:{' '}
          {questionnaire.reads?.length
            ? questionnaire.reads
                .map((value) => readingLabels[value])
                .join(', ')
            : 'пока не указано'}
          .
        </p>
        <p>
          Эти ответы помогают выбрать, что попробовать. Самоотчёт не
          подтверждает навык.
        </p>
        {unavailableInterests && (
          <p>
            Для части выбранных интересов пока нет подходящего материала. Они
            сохранены как пожелание и не меняют критерии проверки.
          </p>
        )}
      </section>
      <Observations state={state} supply={supply} />
      {placement ? (
        <PlacementDetails placement={placement} supply={supply} />
      ) : (
        <p role="status">Следующий шаг ещё не определён.</p>
      )}
      <div className="curriculum-actions">
        {placement &&
          ['formal_route', 'resume_course', 'engine_action'].includes(
            placement.kind,
          ) && (
            <button
              type="button"
              disabled={busy || !noActive}
              onClick={onAccept}
            >
              Продолжить программу
            </button>
          )}
        {canPractice && (
          <button
            type="button"
            disabled={busy || !noActive}
            onClick={onPractice}
          >
            Начать свободную практику
          </button>
        )}
        {placement?.kind === 'entry_checkpoint_needed' && (
          <button
            type="button"
            disabled={busy || !noActive}
            onClick={onPrerequisite}
          >
            Проверить подготовительный навык
          </button>
        )}
        {canSide && (
          <button type="button" disabled={busy} onClick={onSide}>
            Дополнительно проверить: {groupTitle(supply, sideGroup)}
          </button>
        )}
        {deferredGroups.length > 0 && noActive && (
          <button type="button" disabled={busy} onClick={onRetest}>
            Вернуться к отложенной проверке:{' '}
            {groupTitle(supply, deferredGroups[0])}
          </button>
        )}
      </div>
    </section>
  );
}
export default EntryReport;
