import { useState } from 'react';
import { ArrowRight, HelpCircle, RotateCcw, Volume2 } from 'lucide-react';
import ExerciseHeader from '../../components/exercise-header';
import TaskInstruction from '../../components/task-instruction';
import { plural } from '../../lib/plural';
import type { Outcome, Submission } from '../../lib/curriculum/contracts';
import type { LessonModel } from '../lesson/use-lesson';
import { TaskRenderer } from '../curriculum/TaskRenderer';
import type { CurriculumController } from '../curriculum/controller';
import type { TaskPresentation } from '../curriculum/presentation';

export interface SyllablePartsCardProps {
  view: TaskPresentation;
  controller: CurriculumController;
  busy: boolean;
  sound: boolean;
  instructionSound?: boolean;
  speak: (text: string) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  onResult: (outcome: Outcome) => void;
  model: LessonModel;
  position: number;
  total: number;
}

/** The familiar lesson frame; the shared controller remains the grading owner. */
export default function SyllablePartsCard({
  view,
  controller,
  busy,
  sound,
  instructionSound = sound,
  speak,
  run,
  onResult,
  model,
  position,
  total,
}: SyllablePartsCardProps) {
  const [revision, setRevision] = useState(0);
  const title =
    view.taskKind === 'compose' ? 'Собери слог' : 'Найди часть слога';
  const settings = model.settings;
  const rest = settings.breakMinutes
    ? `Отдых через ${settings.breakMinutes} ${plural(settings.breakMinutes, ['минуту', 'минуты', 'минут'])}`
    : settings.breakEvery
      ? `Отдых через ${settings.breakEvery} ${plural(settings.breakEvery, ['задание', 'задания', 'заданий'])}`
      : 'Отдых по кнопке «Разминка»';
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
  const materialAudio = () =>
    act(async () => {
      const current = await controller.help({
        level: view.mode === 'listen' ? 0 : 1,
        targetAudio: true,
      });
      if (current?.kind === 'task') speak(current.text);
    });
  return (
    <section
      className="exercise syllable-parts-exercise"
      aria-busy={busy}
      onPointerDownCapture={model.schedule.touch}
      onKeyDownCapture={model.schedule.touch}
    >
      <ExerciseHeader
        number={position + 1}
        total={total}
        completed={position}
        rest={rest}
      />
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
        text={
          view.taskKind === 'compose'
            ? 'Собери слог из букв по порядку. Затем прочитай его.'
            : view.taskInstruction || view.instruction
        }
        sound={sound && instructionSound}
        speak={instructionAudio}
      />
      <div className="reading syllable-parts-material" aria-label={view.text}>
        {Array.from(view.text).map((char, index) => (
          <span
            key={index}
            className={
              settings.color
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
            onClick={materialAudio}
          >
            <Volume2 size={16} /> Послушать образец
          </button>
        </div>
      )}
      <TaskRenderer
        key={`${view.instanceId}:${revision}`}
        task={view}
        busy={busy}
        compactAudio
        compactControls
        compositionPlaceholder="Здесь появится собранный слог"
        submitLabel="Проверить · Enter"
        onSubmit={submit}
        onReading={(reading) =>
          run(() => controller.recordReading(view.instanceId, reading))
        }
        onReveal={() => run(() => controller.revealOptions())}
      />
      {view.hints.length > 0 && (
        <div className="hint-box">
          {view.hints.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      )}
      <div className="exercise-footer">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            model.stop();
            setRevision((value) => value + 1);
          }}
        >
          <RotateCcw size={16} /> Повторить задание
        </button>
        <button
          type="button"
          disabled={busy || !view.canRequestHint}
          onClick={() => act(() => controller.hint(view.hints.length))}
        >
          <HelpCircle size={16} /> Подсказка
        </button>
        <button
          type="button"
          className="text-button syllable-parts-skip"
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
