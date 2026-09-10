'use client';
import { useId, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, List, Volume2 } from 'lucide-react';
import { topicNames } from '@/lib/topics';
import './topic-bar.css';
export default function TopicBar({
  unit,
  current,
  nextLabel,
  onPrevious,
  onNext,
  onSelect,
  onSpeak,
  speaking = false,
  done = false,
}: {
  unit: number;
  current: string;
  nextLabel: string;
  onPrevious?: () => void;
  onNext: () => void;
  onSelect?: (unit: number) => void;
  onSpeak: () => void;
  speaking?: boolean;
  done?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <nav
      className={'topic-navigation' + (done ? ' topic-completed' : '')}
      aria-label="Темы занятия"
    >
      <div className="topic-heading">
        <div>
          <small>{done ? 'Можно идти дальше' : 'Моя тема'}</small>
          <strong>{current}</strong>
        </div>
        <button
          className="quiet"
          aria-label="Послушать про следующую тему"
          disabled={speaking}
          onClick={onSpeak}
        >
          <Volume2 size={19} />
        </button>
      </div>
      <div className="topic-actions">
        <button
          className="topic-back"
          aria-label="Предыдущая тема"
          disabled={!onPrevious}
          onClick={onPrevious}
        >
          <ArrowLeft size={20} />
        </button>
        {onSelect && (
          <button
            className="topic-list"
            aria-label="Выбрать другую тему"
            title="Выбрать другую тему"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            <List size={21} />
          </button>
        )}
        <button
          className="topic-next"
          onClick={() => {
            setOpen(false);
            onNext();
          }}
        >
          <span>
            Следующая тема<small>{nextLabel}</small>
          </span>
          <ArrowRight size={23} />
        </button>
      </div>
      {open && onSelect && (
        <div className="topic-grid topic-options" id={id}>
          {topicNames.map((name, i) => (
            <button
              key={name}
              aria-current={i === unit ? 'step' : undefined}
              onClick={() => {
                setOpen(false);
                onSelect(i);
              }}
            >
              <span>
                {i + 1}. {name}
              </span>
              {i === unit && <Check size={17} />}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
