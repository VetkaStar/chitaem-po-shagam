'use client';
import { BookOpen, Settings2 } from 'lucide-react';
import type { LessonModel } from './use-lesson';
export default function LessonHeader({
  model,
}: {
  model: Pick<LessonModel, 'stop' | 'setParent'>;
}) {
  const { stop, setParent } = model;
  return (
    <>
      <header>
        <a className="brand" href="/" aria-label="Читаем по шагам">
          <BookOpen />
          <b>
            Читаем <span>по шагам</span>
          </b>
          <small className="lab-label">Чтение · версия 3</small>
        </a>
        <button
          onClick={() => {
            stop();
            setParent(true);
          }}
        >
          <Settings2 size={18} />
          <span>Для взрослого</span>
        </button>
      </header>
    </>
  );
}
