'use client';
import { Mic, Keyboard, Image as ImageIcon, Pause } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mode } from './config';
import type { LessonModel } from './use-lesson';
export default function LessonToolbar({
  model,
}: {
  model: Pick<
    LessonModel,
    'mode' | 'stage' | 'navigate' | 'stop' | 'setPaused' | 'settings' | 'update'
  >;
}) {
  const { mode, stage, navigate, stop, setPaused } = model;
  return (
    <>
      <div className="toolbar">
        {stage !== 'pictures' && (
          <Tabs
            value={mode}
            onValueChange={(v) => {
              navigate(stage, v as Mode);
            }}
          >
            <TabsList className="mode-list">
              <TabsTrigger value="read">
                <Mic /> Читаю
              </TabsTrigger>
              <TabsTrigger value="fly">
                <Keyboard /> Ловлю
              </TabsTrigger>
              <TabsTrigger value="type">
                <ImageIcon /> Пишу
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {stage === 'pictures' && (
          <div className="mode-list" role="group" aria-label="Режим картинок">
            {(['free', 'letters'] as const).map((value) => (
              <button
                key={value}
                aria-pressed={model.settings.pictureMode === value}
                data-active={
                  model.settings.pictureMode === value ? '' : undefined
                }
                onClick={() => model.update('pictureMode', value)}
              >
                {value === 'free' ? 'Свободный ответ' : 'Окошки для букв'}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
