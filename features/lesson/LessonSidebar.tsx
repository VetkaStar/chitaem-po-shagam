'use client';
import { Leaf, Info } from 'lucide-react';
import { textLabels } from '@/content/reading-library';
import { stages } from './config';
import type { LessonModel } from './use-lesson';
export default function LessonSidebar({
  model,
  active,
  onSelect,
  onAbout,
  disabled = false,
}: {
  model: Pick<LessonModel, 'stage' | 'navigate' | 'stop' | 'setRest'>;
  active: string;
  onSelect: (id: string) => void;
  onAbout: () => void;
  disabled?: boolean;
}) {
  const { stop, setRest } = model;
  return (
    <>
      <aside>
        <p>МОЯ ТРОПИНКА</p>
        <nav aria-label="Разделы">
          {[
            ...stages,
            ...Object.entries(textLabels).map(([id, name]) => ({ id, name })),
          ].map((s, i) => (
            <button
              key={s.id}
              className={active === s.id ? 'selected' : ''}
              aria-current={active === s.id ? 'step' : undefined}
              disabled={disabled}
              onClick={() => onSelect(s.id)}
            >
              <b>0{i + 1}</b>
              <span>{s.name}</span>
              {active === s.id && <span className="stage-dot">●</span>}
            </button>
          ))}
        </nav>
        <div className="aside-note">
          <Leaf />
          <h3>В своём темпе</h3>
          <p>
            Можно подумать,
            <br />
            повторить и отдохнуть.
          </p>
        </div>
        <button
          className="break-link"
          onClick={() => {
            stop();
            setRest(true);
          }}
        >
          <Leaf size={18} /> Разминка
        </button>
        <button className="break-link about-link" onClick={onAbout}>
          <Info size={18} /> О проекте
        </button>
      </aside>
    </>
  );
}
