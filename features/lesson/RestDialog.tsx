'use client';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useRef, useEffect } from 'react';
import { visionStyle } from '@/lib/vision';
import RestHub from '@/components/rest-hub';
import type { LessonModel } from './use-lesson';
export default function RestDialog({
  model,
}: {
  model: Pick<
    LessonModel,
    | 'schedule'
    | 'paused'
    | 'rest'
    | 'stop'
    | 'setPaused'
    | 'setRest'
    | 'settings'
    | 'speak'
  >;
}) {
  const { paused, rest, stop, setPaused, setRest, settings, speak } = model;
  const engaged = useRef(false),
    opened = useRef(0);
  useEffect(() => {
    if (rest || paused) {
      engaged.current = false;
      opened.current = Date.now();
    }
  }, [rest, paused]);
  function close() {
    stop();
    model.schedule.returned(
      rest && !engaged.current && Date.now() - opened.current < 15000,
    );
    setPaused(false);
    setRest(false);
  }
  return (
    <>
      <Dialog
        open={paused || rest}
        onOpenChange={(v) => {
          stop();
          if (!v) {
            close();
          }
        }}
      >
        <DialogContent
          className="rest-dialog hub-dialog"
          data-vision={settings.colorVision}
          style={visionStyle(settings.colorVision)}
        >
          <DialogTitle className="dialog-heading">Время отдохнуть</DialogTitle>
          <DialogDescription>
            Можно выбрать игру, размяться или просто побыть в тишине.
          </DialogDescription>
          <RestHub
            onEngage={() => {
              engaged.current = true;
            }}
            vision={settings.colorVision}
            motion={settings.motion}
            autoSpeech={settings.autoSpeech}
            sound={settings.sound}
            onSpeak={speak}
            onReturn={() => {
              close();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
