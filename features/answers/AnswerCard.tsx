import { ArrowRight, HelpCircle, Image, Volume2 } from 'lucide-react';
import ExerciseHeader from '../../components/exercise-header';
import TaskInstruction from '../../components/task-instruction';
import { CurriculumIllustration } from '../curriculum/CurriculumIllustration';
import { TaskRenderer } from '../curriculum/TaskRenderer';
import type { CurriculumController } from '../curriculum/controller';
import type { TaskPresentation } from '../curriculum/presentation';
import type { Outcome, Submission } from '../../lib/curriculum/contracts';
import { answerMaterialLabels, type AnswerSection } from './types';
export interface AnswerCardProps {
  section?: AnswerSection;
  view: TaskPresentation;
  controller: CurriculumController;
  busy: boolean;
  sound: boolean;
  instructionSound?: boolean;
  speak: (text: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  onResult: (outcome: Outcome) => void;
  number: number;
  total: number;
  completed: number;
  color: boolean;
  onActivity: () => void;
}
/** The familiar exercise frame; durable actions still belong to the shared controller. */
export default function AnswerCard({
  view,
  section = 'words',
  controller,
  busy,
  sound,
  instructionSound = sound,
  speak,
  run,
  onResult,
  number,
  total,
  completed,
  color,
  onActivity,
}: AnswerCardProps) {
  const title = 'Ответь на вопрос';
  const act = (action: () => Promise<unknown>) => {
    if (!busy) void run(action).catch(() => undefined);
  };
  const instructionAudio = (text: string) => {
    if (!busy && sound && instructionSound) speak(text);
  };
  const submit = (response: Submission['response']) =>
    run(async () => {
      const saved = await controller.answer({
        instanceId: view.instanceId,
        response,
      });
      const receipt = saved.profile.receipts[view.instanceId];
      if (receipt) onResult(receipt.outcome);
    });
  const playMaterial = () =>
    act(async () => {
      const current = await controller.help({
        level: view.mode === 'listen' ? 0 : 1,
        targetAudio: true,
      });
      if (current?.kind === 'task') speak(current.text);
    });
  return (
    <section
      className="exercise answer-exercise"
      aria-busy={busy}
      onPointerDownCapture={onActivity}
      onKeyDownCapture={onActivity}
    >
      <ExerciseHeader number={number} total={total} completed={completed} />
      <div className="task-line">
        {sound && instructionSound && (
          <button
            type="button"
            className="speak-button"
            disabled={busy}
            aria-label="Озвучить задание"
            onClick={() => instructionAudio(title)}
          >
            <Volume2 size={20} />
          </button>
        )}
        <h2>{title}</h2>
      </div>
      <TaskInstruction
        text={view.taskInstruction || view.instruction}
        sound={sound && instructionSound}
        speak={instructionAudio}
      />
      <div
        className="reading answer-material"
        data-section={section}
        aria-label={view.text}
        data-letters={Array.from(view.text).length}
      >
        {section === 'sentences'
          ? view.text
          : Array.from(view.text).map((char, index) => (
              <span
                key={index}
                className={
                  color
                    ? /[аеёиоуыэюя]/iu.test(char)
                      ? 'vowel'
                      : /[а-яё]/iu.test(char)
                        ? 'consonant'
                        : ''
                    : ''
                }
              >
                {char}
              </span>
            ))}
      </div>
      {sound && (
        <div className="material-tools">
          <button
            type="button"
            className="pill-button sample"
            disabled={busy}
            onClick={playMaterial}
          >
            <Volume2 size={16} /> {answerMaterialLabels[section]}
          </button>
        </div>
      )}
      <TaskRenderer
        compactAudio
        key={view.instanceId}
        task={view}
        busy={busy}
        onSubmit={submit}
        onReading={(reading) =>
          run(() => controller.recordReading(view.instanceId, reading))
        }
        onReveal={() => run(() => controller.revealOptions())}
        onSpeak={
          sound
            ? (questionId, optionId) =>
                act(async () => {
                  const text = await controller.optionAudio(
                    view.instanceId,
                    questionId,
                    optionId,
                  );
                  speak(text);
                })
            : undefined
        }
      />
      <div className="answer-help material-tools">
        <button
          type="button"
          className="pill-button"
          disabled={busy || !view.canRequestHint}
          onClick={() => act(() => controller.hint(view.hints.length))}
        >
          <HelpCircle size={16} /> Подсказка
        </button>
        {view.canShowIllustration && !view.illustration && (
          <button
            type="button"
            className="pill-button"
            disabled={busy}
            onClick={() => act(() => controller.illustration(view.instanceId))}
          >
            <Image size={16} /> Показать картинку
          </button>
        )}
      </div>
      {view.hints.length > 0 && (
        <div className="hint-box">
          {view.hints.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
      {view.illustration && (
        <CurriculumIllustration
          asset={view.illustration}
          busy={busy}
          onVariant={(variant) =>
            act(() => controller.illustration(view.instanceId, variant))
          }
        />
      )}
      <div className="exercise-footer">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() =>
            act(async () => {
              const saved = await controller.answer({
                instanceId: view.instanceId,
                disposition: 'skipped',
              });
              const receipt = saved.profile.receipts[view.instanceId];
              if (receipt) onResult(receipt.outcome);
            })
          }
        >
          Пропустить <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
