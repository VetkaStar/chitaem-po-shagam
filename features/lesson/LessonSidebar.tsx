'use client';
import { Leaf } from 'lucide-react';
import { stages } from './config';
import type { LessonModel } from './use-lesson';
export default function LessonSidebar({
  model,
}: {
  model: Pick<LessonModel, 'stage' | 'navigate' | 'stop' | 'setRest'>;
}) {
  const { stage, navigate, stop, setRest } = model;
  return (
    <>
      <aside>
        <p>МОЯ ТРОПИНКА</p>
        <nav aria-label="Разделы">
          {stages.map((s, i) => (
            <button
              key={s.id}
              className={stage === s.id ? 'selected' : ''}
              aria-current={stage === s.id ? 'step' : undefined}
              onClick={() => navigate(s.id)}
            >
              <b>0{i + 1}</b>
              <span>{s.name}</span>
              {stage === s.id && <span className="stage-dot">●</span>}
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
      </aside>
    </>
  );
}
