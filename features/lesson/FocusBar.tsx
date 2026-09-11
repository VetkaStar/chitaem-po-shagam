'use client';
import { useContext } from 'react';
import { ArrowLeft, Leaf, Settings2, Star } from 'lucide-react';
import { PortalContext } from '../portal/portal-context';
import TopicNavigation from './TopicNavigation';
import type { LessonModel } from './use-lesson';

/** «Фокус» bar over a task: back to all sections, rest, the topic, stars and adult settings. */
export default function FocusBar({ model }: { model: LessonModel }) {
  const { home } = useContext(PortalContext);
  const { stop, setRest, setParent, stars } = model;
  return (
    <div className="focus-bar">
      <div className="focus-bar-start">
        <button className="focus-back" onClick={home}>
          <ArrowLeft size={18} />
          <span>Все разделы</span>
        </button>
        <button
          className="focus-rest"
          onClick={() => {
            stop();
            setRest(true);
          }}
        >
          <Leaf size={18} />
          <span>Разминка</span>
        </button>
      </div>
      <TopicNavigation model={model} compact />
      <div className="focus-bar-end">
        <span className="focus-stars" aria-label={`Звёзд: ${stars}`}>
          <Star size={17} />
          <span>{stars}</span>
        </span>
        <button
          className="focus-adult"
          onClick={() => {
            stop();
            setParent(true);
          }}
        >
          <Settings2 size={18} />
          <span>Для взрослого</span>
        </button>
      </div>
    </div>
  );
}
