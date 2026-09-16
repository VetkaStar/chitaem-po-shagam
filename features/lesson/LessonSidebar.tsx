'use client';
import { useEffect, useId, useState, useRef } from 'react';
import { ChevronDown, Info, Leaf, Settings2, UserRound, X } from 'lucide-react';
import { sections } from '../trainers/navigation';
import type { LessonModel } from './use-lesson';
export default function LessonSidebar({
  model,
  active,
  selectedItem,
  onSelect,
  onAbout,
  onCabinet,
  onClose,
  open = false,
  disabled = false,
}: {
  model: Pick<LessonModel, 'stop' | 'setRest' | 'setParent'>;
  active: string;
  selectedItem?: string;
  onSelect: (id: string) => void;
  onAbout: () => void;
  onCabinet: () => void;
  onClose: () => void;
  open?: boolean;
  disabled?: boolean;
}) {
  const { stop, setRest, setParent } = model;
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuId = useId();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(null);
    };
    const outside = (event: PointerEvent) => {
      if (
        window.innerWidth >= 700 &&
        window.innerWidth <= 1099 &&
        event.target instanceof Node &&
        !navigation.current?.contains(event.target)
      )
        setExpanded(null);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [expanded]);
  useEffect(() => {
    setExpanded(
      sections.some((section) => section.id === active) ? active : null,
    );
  }, [active]);
  return (
    <aside
      ref={navigation}
      className="app-nav"
      data-open={open ? '' : undefined}
    >
      <div className="app-nav-panel">
        <div className="app-nav-head">
          <p className="app-nav-title">Тренажёры</p>
          <button
            className="app-nav-close"
            aria-label="Закрыть меню"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <nav aria-label="Разделы">
          {sections.map((s, i) => (
            <div className="app-nav-group" key={s.id}>
              <button
                className={
                  'app-nav-item' + (active === s.id ? ' selected' : '')
                }
                aria-current={active === s.id ? 'step' : undefined}
                aria-expanded={expanded === s.id}
                aria-controls={`${menuId}-${s.id}`}
                disabled={disabled}
                onClick={() =>
                  setExpanded((current) => (current === s.id ? null : s.id))
                }
              >
                <b>0{i + 1}</b>
                <span>{s.name}</span>
                <ChevronDown
                  className="app-nav-chevron"
                  size={16}
                  aria-hidden="true"
                />
              </button>
              <div
                id={`${menuId}-${s.id}`}
                className="app-nav-submenu"
                hidden={expanded !== s.id}
              >
                {s.items.map((item) => (
                  <button
                    key={item.id}
                    className={
                      'app-nav-child' +
                      (selectedItem === item.id ? ' selected' : '')
                    }
                    aria-current={selectedItem === item.id ? 'page' : undefined}
                    disabled={disabled}
                    onClick={() => onSelect(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
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
            className={
              'app-nav-quiet about-link' +
              (active === 'about' ? ' selected' : '')
            }
            aria-label="О проекте"
            title="О проекте"
            onClick={onAbout}
          >
            <Info size={18} />
            <span>О проекте</span>
          </button>
        </div>
        <div className="app-nav-account">
          <button
            className="app-nav-quiet"
            onClick={onCabinet}
            disabled={disabled}
          >
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
      <button
        className="app-nav-backdrop"
        aria-label="Закрыть меню"
        tabIndex={-1}
        onClick={onClose}
      />
    </aside>
  );
}
