import type { CurriculumController } from './controller.js';

export function ProgramPracticeList({ controller, busy, onSelect }: {
  controller: CurriculumController;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const state = controller.snapshot();
  const options = controller.programPracticeOptions().filter(branch => branch.programId === state.profile.currentProgramId);
  if (!options.length || controller.currentProgramPractice()) return null;
  return <details className="curriculum-practice-list">
    <summary>Слова и короткие тексты</summary>
    <p>Практика по выбранному методу. После неё можно вернуться к прежнему заданию.</p>
    {options.some(branch => branch.missing.letters.length || branch.missing.capabilities.length) &&
      <p>Незнакомые буквы и части сначала прочитайте вместе со взрослым. Это подготовка, а не проверка.</p>}
    <div className="curriculum-actions">{options.map(branch => <div key={branch.id}>
      <button type="button" disabled={busy} onClick={() => onSelect(branch.id)}>
        {branch.label}{branch.position >= branch.steps.length ? ' - пройдено' : branch.position ? ' - продолжить' : ''}
      </button>
    </div>)}</div>
  </details>;
}
