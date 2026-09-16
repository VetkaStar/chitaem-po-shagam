'use client';
import { MessageCircle, Mic, Pencil, Target } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mode } from './config';
import type { LessonModel } from './use-lesson';
export default function LessonToolbar({
  model,
  answer = false,
  onAnswer,
  onPractice,
}: {
  model: Pick<
    LessonModel,
    'mode' | 'stage' | 'navigate' | 'settings' | 'update'
  >;
  answer?: boolean;
  onAnswer?: () => void;
  onPractice?: (mode: Mode) => void;
}) {
  const { mode, stage, navigate } = model;
  return (
    <>
      <div className="toolbar">
        {stage !== 'pictures' && (
          <Tabs
            value={answer ? 'answer' : mode}
            onValueChange={(v) => {
              if (v === 'answer') onAnswer?.();
              else if (onPractice) onPractice(v as Mode);
              else navigate(stage, v as Mode);
            }}
          >
            <TabsList className="mode-list">
              <TabsTrigger value="read">
                <Mic /> Читаю
              </TabsTrigger>
              <TabsTrigger value="fly">
                <Target /> Ловлю
              </TabsTrigger>
              <TabsTrigger value="type">
                <Pencil /> Пишу
              </TabsTrigger>
              {['letters', 'syllables', 'words'].includes(stage) &&
                onAnswer && (
                  <TabsTrigger value="answer">
                    <MessageCircle /> Отвечаю
                  </TabsTrigger>
                )}
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
