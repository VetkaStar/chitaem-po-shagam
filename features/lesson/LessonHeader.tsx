'use client';
import { BookOpen, Menu, Settings2, Star, UserRound } from 'lucide-react';
import type { LessonModel } from './use-lesson';
export default function LessonHeader({
  model,
  onHome,
  onCabinet,
  onMenu,
  active,
  hasProfile = true,
}: {
  model: Pick<LessonModel, 'stop' | 'setParent' | 'stars'>;
  onHome: () => void;
  onCabinet: () => void;
  onMenu: () => void;
  active?: string;
  hasProfile?: boolean;
}) {
  const { stop, setParent, stars } = model;
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <a
          className="app-brand"
          href="./"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          aria-label="Читаем по шагам — главная"
        >
          <span className="app-brand-mark">
            <BookOpen size={20} />
          </span>
          <span className="app-brand-name">
            Читаем <span>по шагам</span>
          </span>
        </a>
        <div className="app-bar-actions">
          {hasProfile && (
            <span className="app-bar-stars" aria-label={`Звёзд: ${stars}`}>
              <Star size={16} />
              <span>{stars}</span>
            </span>
          )}
          <button
            className={'app-bar-button' + (active === 'cabinet' ? ' selected' : '')}
            onClick={onCabinet}
            disabled={!hasProfile}
          >
            <UserRound size={18} />
            <span>Мой кабинет</span>
          </button>
          <button
            className="app-bar-button"
            onClick={() => {
              stop();
              setParent(true);
            }}
          >
            <Settings2 size={18} />
            <span>Для взрослого</span>
          </button>
          <button className="app-bar-menu" aria-label="Открыть меню" onClick={onMenu}>
            <Menu size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
