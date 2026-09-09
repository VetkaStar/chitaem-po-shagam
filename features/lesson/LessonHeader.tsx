'use client';
import { BookOpen, Settings2, UserRound } from 'lucide-react';
import type { LessonModel } from './use-lesson';
export default function LessonHeader({
  model,
  onHome,
  onCabinet,
  hasProfile = true,
}: {
  model: Pick<LessonModel, 'stop' | 'setParent'>;
  onHome: () => void;
  onCabinet: () => void;
  hasProfile?: boolean;
}) {
  const { stop, setParent } = model;
  return (
    <>
      <header>
        <a
          className="brand"
          href="./"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          aria-label="Читаем по шагам — главная"
        >
          <BookOpen />
          <b>
            Читаем <span>по шагам</span>
          </b>
          <small className="lab-label">Чтение · версия 3</small>
        </a>
        <div className="header-actions">
          <button onClick={onCabinet} disabled={!hasProfile}>
            <UserRound size={18} />
            <span>Мой кабинет</span>
          </button>
          <button
            onClick={() => {
              stop();
              setParent(true);
            }}
          >
            <Settings2 size={18} />
            <span>Для взрослого</span>
          </button>
        </div>
      </header>
    </>
  );
}
