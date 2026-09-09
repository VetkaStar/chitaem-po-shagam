'use client';
import { ArrowLeft, ArrowRight, Check, Volume2 } from 'lucide-react';
import { nextTopic, topicNames } from '@/lib/topics';
import type { Stage } from './config';
import type { LessonModel } from './use-lesson';

export default function TopicNavigation({ model }: { model: Pick<LessonModel, 'stage' | 'settings' | 'changeTopic' | 'done' | 'speak' | 'speaking'> }) {
  const { stage, settings, changeTopic, done, speak, speaking } = model;
  const next = nextTopic(stage, settings.unit);
  const current = stage === 'pictures' ? 'Называем картинки' : topicNames[settings.unit];
  return <nav className={'topic-navigation' + (done ? ' topic-completed' : '')} aria-label="Темы занятия">
    <div className="topic-heading"><div><small>{done ? 'Можно идти дальше' : 'Моя тема'}</small><strong>{current}</strong></div>
      <button className="quiet" aria-label="Послушать про следующую тему" disabled={speaking} onClick={() => speak(`Сейчас: ${current}. Следующая тема: ${next.label}. Нажми на стрелку, когда захочешь идти дальше.`)}><Volume2 size={19}/></button>
    </div>
    <div className="topic-actions">
      {stage !== 'pictures' && settings.unit > 0 && <button className="topic-back" aria-label="Предыдущая тема" onClick={() => changeTopic(stage, settings.unit - 1)}><ArrowLeft size={20}/></button>}
      <button className="topic-next" onClick={() => changeTopic(next.stage as Stage, next.unit)}><span>Следующая тема<small>{next.label}</small></span><ArrowRight size={23}/></button>
    </div>
    {stage !== 'pictures' && <details className="topic-picker"><summary>Выбрать другую тему</summary><div className="topic-grid">{topicNames.map((name, unit) => <button key={name} aria-current={unit === settings.unit ? 'step' : undefined} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); changeTopic(stage, unit); }}><span>{unit + 1}. {name}</span>{unit === settings.unit && <Check size={17}/>}</button>)}</div></details>}
  </nav>;
}
