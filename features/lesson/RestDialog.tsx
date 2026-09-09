'use client';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import RestHub from '@/components/rest-hub';
import type { LessonModel } from './use-lesson';
export default function RestDialog({
  model,
}: {
  model: Pick<
    LessonModel,
    'paused' | 'rest' | 'stop' | 'setPaused' | 'setRest' | 'settings' | 'speak'
  >;
}) {
  const { paused, rest, stop, setPaused, setRest, settings, speak } = model;
  return (
    <>
      <Dialog
        open={paused || rest}
        onOpenChange={(v) => {
          stop();
          if (!v) {
            setPaused(false);
            setRest(false);
          }
        }}
      >
        <DialogContent className="rest-dialog hub-dialog">
          <DialogTitle className="dialog-heading">Время отдохнуть</DialogTitle>
          <DialogDescription>
            Можно выбрать игру, размяться или просто побыть в тишине.
          </DialogDescription>
          <RestHub
            motion={settings.motion}
            autoSpeech={settings.autoSpeech}
            sound={settings.sound}
            onSpeak={speak}
            onReturn={() => {
              stop();
              setPaused(false);
              setRest(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
