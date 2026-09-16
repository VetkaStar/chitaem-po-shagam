import { useEffect, useState } from 'react';
import {
  BookOpen,
  Headphones,
  Puzzle,
  Search,
  Scissors,
  Replace,
  Users,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import TopicBar from '../../components/topic-bar';
import { topicNames } from '../../lib/topics';
import { loadBundledSupply } from '../../lib/curriculum/bundled';
import type { Mode } from '../../lib/curriculum/contracts';
import LessonWorkspace from '../lesson/LessonWorkspace';
import type { LessonModel } from '../lesson/use-lesson';
import TrainerEntry from './TrainerEntry';
import TrainerPracticeSettings from './TrainerPracticeSettings';
import { availableModes, trainerItems, trainerModeLabels } from './catalog';
import { sections, type TrainerLink } from './navigation';
import type { TrainerSection } from './task-section';

const modeIcons = {
  compose: Puzzle,
  find_part: Search,
  boundary: Scissors,
  transform: Replace,
  read: BookOpen,
  listen: Headphones,
  shared: Users,
};
export default function TrainerWorkspace({
  model,
  onExit,
  section,
  trainer,
}: {
  model: LessonModel;
  onExit: () => void;
  section: TrainerSection;
  trainer: TrainerLink;
}) {
  const [mode, setMode] = useState(trainer.modes?.[0].id ?? 'read');
  const [presentationModes, setPresentationModes] = useState<Mode[]>(['read']);
  const [busy, setBusy] = useState(false);
  const unit = model.settings.unit;
  const sectionIndex = sections.findIndex((item) => item.id === section);
  const sectionName = sections[sectionIndex].name;
  useEffect(() => {
    if (trainer.modes) return;
    let cancelled = false;
    void loadBundledSupply()
      .then((supply) => {
        if (!cancelled)
          setPresentationModes(
            availableModes(trainerItems(supply, 'read_meaning', section)),
          );
      })
      .catch(() => {
        // TrainerEntry renders the shared loading error and retry action.
      });
    return () => {
      cancelled = true;
    };
  }, [trainer, section]);
  const modes =
    trainer.modes ??
    presentationModes.map((id) => ({ id, title: trainerModeLabels[id] }));
  const select = (next: number) => {
    if (busy) return;
    model.stop();
    model.update('unit', next);
  };
  return (
    <LessonWorkspace
      model={model}
      title={trainer.title}
      label={`ШАГ ${sectionIndex + 1} · ${sectionName.toUpperCase()}`}
      topic={(compact) => (
        <TopicBar
          compact={compact}
          chipLabel={`${sectionName} · тема`}
          caption={`Тема ${unit + 1} из ${topicNames.length}`}
          unit={unit}
          current={topicNames[unit]}
          nextLabel={topicNames[(unit + 1) % topicNames.length]}
          onPrevious={unit > 0 ? () => select(unit - 1) : undefined}
          onNext={() => select((unit + 1) % topicNames.length)}
          onSelect={select}
          onSpeak={() => model.speak(topicNames[unit])}
        />
      )}
      toolbar={
        <div className="toolbar">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (busy || value === mode) return;
              model.stop();
              setMode(value);
            }}
          >
            <TabsList
              className="mode-list trainer-mode-list"
              aria-label="Режимы тренажёра"
            >
              {modes.map((item) => {
                const Icon = modeIcons[item.id];
                return (
                  <TabsTrigger key={item.id} value={item.id} disabled={busy}>
                    <Icon /> {item.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      }
      controls={<TrainerPracticeSettings model={model} />}
    >
      <TrainerEntry
        key={`${trainer.id}:${mode}:${unit}`}
        trainerId={trainer.modes ? mode : 'read_meaning'}
        presentationMode={trainer.modes ? 'read' : (mode as Mode)}
        model={model}
        section={section}
        title={trainer.title}
        embedded
        sound={model.settings.sound}
        speak={model.speak}
        onExit={onExit}
        onBusyChange={setBusy}
      />
    </LessonWorkspace>
  );
}
