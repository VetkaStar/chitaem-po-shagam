import { useRef, useState } from 'react';
import type { Supply } from '../../lib/curriculum/types.js';
import type { CurriculumController } from '../curriculum/controller.js';
import CurriculumSession from '../curriculum/CurriculumSession.js';
import QuestionnaireForm from './QuestionnaireForm.js';
import AccessSetup from './AccessSetup.js';
import EntryWorkspace from './EntryWorkspace.js';
import EntryReport from './EntryReport.js';
import Roadmap from '../roadmap/Roadmap.js';
export interface Props {
  onPreferences?: (
    q: import('../../lib/curriculum/types.js').Questionnaire,
  ) => void;
  controller: CurriculumController;
  supply: Supply;
  sound: boolean;
  speak: (text: string) => void;
  onExit: () => void;
}
export default function OnboardingRoot(props: Props) {
  const { controller, supply, sound, speak, onExit } = props;
  const [state, setState] = useState(() => controller.snapshot()),
    [showSession, setShowSession] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const queue = useRef(Promise.resolve()),
    count = useRef(0);
  const run = (action: () => Promise<unknown>): Promise<void> => {
    count.current++;
    setBusy(true);
    const result = queue.current.then(async () => {
      setError('');
      try {
        await action();
        setState(controller.snapshot());
      } catch (e) {
        setError(
          e instanceof Error && e.message.includes('REVISION_CONFLICT')
            ? 'Сохранение изменилось в другой вкладке. Перечитай его.'
            : 'Не удалось сохранить действие. Можно повторить попытку или вернуться к тренажёрам.',
        );
        throw e;
      } finally {
        count.current--;
        setBusy(count.current > 0);
      }
    });
    queue.current = result.catch(() => undefined);
    return result;
  };
  const act = (action: () => Promise<unknown>) => {
    void run(action).catch(() => undefined);
  };
  const exit = () =>
    act(async () => {
      await controller.deferSetup();
      onExit();
    });
  const audio =
    sound &&
    state.onboarding.questionnaire.audioUsable === true &&
    state.onboarding.questionnaire.instructionAudio !== 'off';
  const programs = supply.curriculum.programs.map((p) => ({
    id: p.id,
    title: p.title,
  }));
  const hasRoute = Boolean(state.profile.currentProgramId);
  if (
    hasRoute &&
    state.studyMode !== 'entry' &&
    state.studyMode !== 'demonstration' &&
    !showSession
  )
    return (
      <>
        {error && (
          <div role="alert" className="curriculum-save-error">
            <p>{error}</p>
            <button onClick={() => act(() => controller.refresh())}>
              Перечитать сохранение
            </button>
          </div>
        )}
        <Roadmap
          state={state}
          supply={supply}
          busy={busy}
          onContinue={() =>
            act(async () => {
              await controller.selectProgram(state.profile.currentProgramId!);
              setShowSession(true);
            })
          }
          onProgram={(id) => act(() => controller.selectProgram(id))}
          onSetup={() => act(() => controller.resumeSetup())}
          onInterests={(tags) => act(() => controller.updateInterests(tags))}
          onExit={onExit}
        />
      </>
    );
  if (state.studyMode === 'recommended' || state.studyMode === 'demonstration')
    return (
      <>
        {state.studyMode === 'demonstration' && (
          <button
            disabled={busy}
            onClick={() => act(() => controller.resumeSetup())}
          >
            Вернуться к настройке
          </button>
        )}
        <CurriculumSession
          controller={controller}
          programs={programs}
          sound={audio}
          autoInstruction={
            state.onboarding.questionnaire.instructionAudio === 'always'
          }
          speak={speak}
          allowProgramSelection={state.onboarding.setupStatus === 'completed'}
          onExit={onExit}
          onRoadmap={
            state.studyMode === 'recommended'
              ? () => {
                  setState(controller.snapshot());
                  setShowSession(false);
                }
              : undefined
          }
        />
      </>
    );
  const flow = state.onboarding.entry,
    activeSetup = state.studyMode === 'entry';
  return (
    <section
      className="curriculum-session"
      aria-label="Настройка учебной программы"
      aria-busy={busy}
    >
      <header className="curriculum-session-header">
        <h1>Учебные программы</h1>
        <button disabled={busy} onClick={exit}>
          Настроить позже
        </button>
      </header>
      <div className="curriculum-session-progress" role="status">
        {state.profile.currentVisit
          ? 'Экраны подхода: ' +
            state.profile.currentVisit.actions +
            ' из ' +
            state.profile.currentVisit.budget
          : 'Настройка по желанию'}
      </div>
      {error && (
        <div className="curriculum-save-error" role="alert">
          <p>{error}</p>
          <button
            disabled={busy}
            onClick={() => act(() => controller.refresh())}
          >
            Перечитать сохранение
          </button>
          <button onClick={onExit}>Все тренажёры</button>
        </div>
      )}
      {!activeSetup ? (
        <section className="curriculum-step">
          <p>
            Можно выбрать удобное начало или заниматься в тренажёрах без
            дорожки.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => act(() => controller.resumeSetup())}
          >
            Настроить программу
          </button>
        </section>
      ) : state.onboarding.screen === 'questionnaire' ? (
        <QuestionnaireForm
          value={state.onboarding.questionnaire}
          busy={busy}
          onSave={(q) => run(() => controller.saveQuestionnaire(q, null))}
          onContinue={() =>
            act(async () => {
              await controller.continueQuestionnaire();
              props.onPreferences?.(
                controller.snapshot().onboarding.questionnaire,
              );
            })
          }
          onDemonstrate={() => act(() => controller.selectDemonstration('p1'))}
        />
      ) : state.onboarding.screen === 'access_setup' ? (
        <AccessSetup
          value={state.onboarding.questionnaire}
          attempts={flow?.access.attempts ?? 0}
          passed={flow?.access.passed ?? false}
          busy={busy}
          onSave={(q) =>
            run(async () => {
              await controller.saveAccess(q);
              props.onPreferences?.(q);
            })
          }
          onAnswer={(shape) => act(() => controller.answerAccess(shape))}
          onContinue={() => act(() => controller.startEntryCheck())}
        />
      ) : flow?.practice || state.onboarding.screen === 'entry_checkpoint' ? (
        <EntryWorkspace
          {...props}
          sound={audio}
          state={state}
          busy={busy}
          run={run}
        />
      ) : (
        <>
          <button
            disabled={busy}
            onClick={() => act(() => controller.editQuestionnaire())}
          >
            Изменить ответы анкеты
          </button>
          <EntryReport
            state={state}
            supply={supply}
            busy={busy}
            onAccept={() => act(() => controller.acceptPlacement())}
            onPractice={() => act(() => controller.startEntryPractice())}
            onPrerequisite={() => act(() => controller.requestPrerequisite())}
            onSide={() => act(() => controller.requestSideCheck())}
            onRetest={() => act(() => controller.retestEntry())}
          />
        </>
      )}
    </section>
  );
}
