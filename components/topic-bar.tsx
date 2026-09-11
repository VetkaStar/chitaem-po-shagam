'use client';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  List,
  Volume2,
} from 'lucide-react';
import { topicNames } from '@/lib/topics';
import './topic-bar.css';

/** Topic of the lesson. Full row: speaker, current topic, list of topics, previous and next topic.
 *  Compact chip for the «Фокус» bar: speaker and the current topic, which opens the list. */
export default function TopicBar({
  autoControl,
  caption,
  chipLabel = 'Тема',
  compact = false,
  nextTitle = 'Следующая тема',
  nextShort = 'Следующая',
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
  autoControl?: ReactNode;
  caption?: string;
  chipLabel?: string;
  compact?: boolean;
  nextTitle?: string;
  nextShort?: string;
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
  const speaker = (
    <button
      className="speak-button"
      aria-label="Послушать про следующую тему"
      disabled={speaking}
      onClick={onSpeak}
    >
      <Volume2 size={19} />
    </button>
  );
  const options = open && onSelect && (
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
  );
  if (compact)
    return (
      <nav
        className={'topic-navigation topic-compact' + (done ? ' topic-completed' : '')}
        aria-label="Темы занятия"
      >
        <div className="topic-chip">
          {speaker}
          {onSelect ? (
            <button
              className="topic-chip-open"
              aria-label={`Выбрать другую тему. Сейчас: ${current}`}
              title="Выбрать другую тему"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen(!open)}
            >
              <small>{chipLabel}</small>
              <strong>{current}</strong>
              <ChevronDown size={18} />
            </button>
          ) : (
            <div className="topic-chip-open">
              {chipLabel && <small>{chipLabel}</small>}
              <strong>{current}</strong>
            </div>
          )}
        </div>
        {options}
      </nav>
    );
  return (
    <nav
      className={'topic-navigation' + (done ? ' topic-completed' : '')}
      aria-label="Темы занятия"
    >
      <div className="topic-bar">
        {speaker}
        <div className="topic-heading">
          <small>{done ? 'Можно идти дальше' : (caption ?? 'Моя тема')}</small>
          <strong>{current}</strong>
        </div>
        {onSelect && (
          <button
            className="topic-list"
            aria-label="Выбрать другую тему"
            title="Выбрать другую тему"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            <List size={17} />
            <span>Все темы</span>
          </button>
        )}
        <span className="topic-spacer" />
        {(onSelect || onPrevious) && (
          <button
            className="topic-back"
            aria-label="Предыдущая тема"
            disabled={!onPrevious}
            onClick={onPrevious}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          className="topic-next"
          aria-label={`${nextTitle}: ${nextLabel}`}
          onClick={() => {
            setOpen(false);
            onNext();
          }}
        >
          <span className="topic-next-title">{nextTitle}:</span>
          <b>{nextLabel}</b>
          <span className="topic-next-short">{nextShort}</span>
          <ArrowRight size={18} />
        </button>
      </div>
      {autoControl && <div className="topic-auto">{autoControl}</div>}
      {options}
    </nav>
  );
}
