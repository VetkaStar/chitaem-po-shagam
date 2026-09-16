'use client';
import AppPortal from '../portal/AppPortal';
import { useLesson } from './use-lesson';
import LessonWorkspace from './LessonWorkspace';
export default function ReadingApp() {
  const model = useLesson();
  return (
    <AppPortal model={model}>
      {(onAnswer) => <LessonWorkspace model={model} onAnswer={onAnswer} />}
    </AppPortal>
  );
}
