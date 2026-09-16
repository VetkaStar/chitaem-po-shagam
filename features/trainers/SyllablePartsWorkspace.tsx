import { useState } from 'react';
import { SlidersHorizontal, Puzzle, Search } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import TopicBar from '../../components/topic-bar';
import { topicNames } from '../../lib/topics';
import LessonWorkspace from '../lesson/LessonWorkspace';
import type { LessonModel } from '../lesson/use-lesson';
import TrainerEntry from './TrainerEntry';
export default function SyllablePartsWorkspace({
  model,
  onExit,
}: {
  model: LessonModel;
  onExit: () => void;
}) {
  const [mode, setMode] = useState<'compose' | 'find_part'>('compose');
  const [busy, setBusy] = useState(false);
  const unit = model.settings.unit;
  const select = (next: number) => {
    if (busy) return;
    model.stop();
    model.update('unit', next);
  };
  return (
    <LessonWorkspace
      model={model}
      title="Состав слога"
      label="ШАГ 2 · СЛОГИ"
      topic={(compact) => (
        <TopicBar
          compact={compact}
          chipLabel="Слоги · тема"
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
              if (busy) return;
              model.stop();
              setMode(value as typeof mode);
            }}
          >
            <TabsList className="mode-list" aria-label="Режимы тренажёра">
              <TabsTrigger value="compose" disabled={busy}>
                <Puzzle /> Собираем
              </TabsTrigger>
              <TabsTrigger value="find_part" disabled={busy}>
                <Search /> Находим часть
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      }
      controls={
        <button
          className="syllable-parts-settings"
          aria-label="Настройки"
          onClick={() => {
            model.stop();
            model.setParent(true);
          }}
        >
          <SlidersHorizontal size={17} />
          <span>Настройки</span>
        </button>
      }
    >
      <TrainerEntry
        key={`${mode}:${unit}`}
        trainerId={mode}
        model={model}
        section="syllables"
        title="Состав слога"
        embedded
        sound={model.settings.sound}
        speak={model.speak}
        onExit={onExit}
        onBusyChange={setBusy}
      />
    </LessonWorkspace>
  );
}
