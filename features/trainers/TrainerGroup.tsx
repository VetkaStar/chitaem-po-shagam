import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import TrainerEntry from './TrainerEntry';
import type { TrainerLink } from './navigation';
import type { TrainerSection } from './task-section';
export default function TrainerGroup({
  trainer,
  section,
  sound,
  speak,
  onExit,
  onModeChange,
}: {
  trainer: TrainerLink;
  section: TrainerSection;
  sound: boolean;
  speak: (text: string) => void;
  onExit: () => void;
  onModeChange: () => void;
}) {
  const modes = trainer.modes!;
  const [mode, setMode] = useState(modes[0].id);
  const [busy, setBusy] = useState(false);
  return (
    <section className="trainer-group lesson" aria-label={trainer.title}>
      <div className="lesson-top">
        <h1>{trainer.title}</h1>
        <button disabled={busy} onClick={onExit}>
          К разделу
        </button>
      </div>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (busy || value === mode) return;
          onModeChange();
          setMode(value as typeof mode);
        }}
      >
        <TabsList
          className="mode-list trainer-mode-list"
          aria-label="Режимы тренажёра"
        >
          {modes.map((item) => (
            <TabsTrigger key={item.id} value={item.id} disabled={busy}>
              {item.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <TrainerEntry
        key={mode}
        trainerId={mode}
        section={section}
        title={trainer.title}
        sound={sound}
        speak={speak}
        onExit={onExit}
        embedded
        onBusyChange={setBusy}
      />
    </section>
  );
}
