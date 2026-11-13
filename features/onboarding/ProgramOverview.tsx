import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import { useCurriculumSession } from '../curriculum/use-curriculum-session';
import Roadmap from '../roadmap/Roadmap';
import { ProgramPracticeList } from '../curriculum/ProgramPracticeList';

export default function ProgramOverview({ controller, supply, onContinue, onPersonal, onExit }: {
  controller: CurriculumController;
  supply: Supply;
  onContinue: () => void;
  onPersonal: () => void;
  onExit: () => void;
}) {
  const { state, busy, error, act } = useCurriculumSession(controller);
  return <>
    {error && <div role="alert" className="storage-note"><p>{error}</p>
      <button disabled={busy} onClick={() => act(() => controller.refresh())}>Перечитать сохранение</button></div>}
    <Roadmap state={state} supply={supply} busy={busy}
      title="Результаты учебных программ" exitLabel="К выбору программы" setupLabel="К короткому знакомству"
      onContinue={() => act(async () => { await controller.selectProgram(state.profile.currentProgramId!); onContinue(); })}
      onProgram={(id) => act(() => controller.selectProgram(id))}
      onInterests={(tags) => act(() => controller.updateInterests(tags))}
      onSetup={onPersonal} onExit={onExit} />
    <ProgramPracticeList controller={controller} busy={busy}
      onSelect={id => act(async () => { await controller.selectProgramPractice(id); onContinue(); })} />
  </>;
}
