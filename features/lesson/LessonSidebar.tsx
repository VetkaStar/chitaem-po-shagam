'use client';
import { Info, Leaf, Settings2, UserRound, X } from 'lucide-react';
import { textLabels } from '@/content/reading-library';
import { stages } from './config';
import type { LessonModel } from './use-lesson';
export default function LessonSidebar({
  model,
  active,
  onSelect,
  onAbout,
  onCabinet,
  onClose,
  open = false,
  disabled = false,
}: {
  model: Pick<LessonModel, 'stop' | 'setRest' | 'setParent'>;
  active: string;
  onSelect: (id: string) => void;
  onAbout: () => void;
  onCabinet: () => void;
  onClose: () => void;
  open?: boolean;
  disabled?: boolean;
}) {
  const { stop, setRest, setParent } = model;
  const sections = [
    ...stages,
    ...Object.entries(textLabels).map(([id, name]) => ({ id, name })),
  ];
  return (
    <aside className="app-nav" data-open={open ? '' : undefined}>
      <div className="app-nav-panel">
        <div className="app-nav-head">
          <p className="app-nav-title">Моя тропинка</p>
          <button className="app-nav-close" aria-label="Закрыть меню" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Разделы">
          {sections.map((s, i) => (
            <button
              key={s.id}
              className={'app-nav-item' + (active === s.id ? ' selected' : '')}
              aria-current={active === s.id ? 'step' : undefined}
              disabled={disabled}
              onClick={() => onSelect(s.id)}
            >
              <b>0{i + 1}</b>
              <span>{s.name}</span>
            </button>
          ))}
        </nav>
        <div className="app-nav-extra">
          <button
            className="app-nav-quiet"
            onClick={() => {
              onClose();
              stop();
              setRest(true);
            }}
          >
            <Leaf size={18} />
            <span>Разминка</span>
          </button>
          <button
            className={'app-nav-quiet about-link' + (active === 'about' ? ' selected' : '')}
            aria-label="О проекте"
            title="О проекте"
            onClick={onAbout}
          >
            <Info size={18} />
            <span>О проекте</span>
          </button>
        </div>
        <div className="app-nav-account">
          <button className="app-nav-quiet" onClick={onCabinet} disabled={disabled}>
            <UserRound size={18} />
            <span>Мой кабинет</span>
          </button>
          <button
            className="app-nav-quiet"
            onClick={() => {
              onClose();
              stop();
              setParent(true);
            }}
          >
            <Settings2 size={18} />
            <span>Для взрослого</span>
          </button>
        </div>
      </div>
      <button className="app-nav-backdrop" aria-label="Закрыть меню" tabIndex={-1} onClick={onClose} />
    </aside>
  );
}
