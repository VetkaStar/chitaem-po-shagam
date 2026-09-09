'use client';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { LessonModel } from './use-lesson';
export default function MicrophoneConsent({
  model,
}: {
  model: Pick<
    LessonModel,
    'consent' | 'setConsent' | 'update' | 'setLessonMic'
  >;
}) {
  const { consent, setConsent, update, setLessonMic } = model;
  return (
    <>
      <Dialog open={consent} onOpenChange={setConsent}>
        <DialogContent>
          <DialogTitle className="dialog-heading">
            Взрослому: включить микрофон?
          </DialogTitle>
          <DialogDescription>
            Приложение загрузит русскую модель и будет распознавать речь на этом
            устройстве. Голос не отправляется на сервер и не сохраняется.
            Автопроверка может ошибаться, особенно на отдельных буквах и слогах.
          </DialogDescription>
          <button
            className="primary"
            onClick={() => {
              update('micConsent', true);
              setConsent(false);
              setLessonMic(true);
            }}
          >
            Разрешаю распознавание
          </button>
          <button onClick={() => setConsent(false)}>Будем читать вместе</button>
        </DialogContent>
      </Dialog>
    </>
  );
}
