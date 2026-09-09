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
    'mode' | 'stage' | 'navigate' | 'stop' | 'setPaused'
  >;
}) {
  const { mode, stage, navigate, stop, setPaused } = model;
  return (
    <>
      <div className="toolbar">
        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (stage === 'pictures') return;
            navigate(stage, v as Mode);
          }}
        >
          <TabsList className="mode-list">
            <TabsTrigger value="read" disabled={stage === 'pictures'}>
              <Mic /> Читаю
            </TabsTrigger>
            <TabsTrigger value="fly" disabled={stage === 'pictures'}>
              <Keyboard /> Ловлю
            </TabsTrigger>
            <TabsTrigger value="type">
              <ImageIcon /> Пишу
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <button
          className="quiet"
          onClick={() => {
            stop();
            setPaused(true);
          }}
          aria-label="Пауза"
        >
          <Pause size={18} />
        </button>
      </div>
    </>
  );
}
