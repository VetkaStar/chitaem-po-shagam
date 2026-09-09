'use client';
import './practice.css';
import AppPortal from '../portal/AppPortal';
import { Leaf, Star } from 'lucide-react';
import { levels } from '@/lib/learning';
import { stages } from './config';
import { useLesson } from './use-lesson';
import LessonToolbar from './LessonToolbar';
import ExerciseCard from './ExerciseCard';
import PracticeControls from './PracticeControls';
import TopicNavigation from './TopicNavigation';
export default function ReadingApp() {
  const model = useLesson();
  const { settings, stage, currentStage, stars, done } = model;
  return (
    <AppPortal model={model}>
      <section className="lesson">
        <div className="lesson-top">
          <div>
            <small>
              ШАГ 0{stages.findIndex((s) => s.id === stage) + 1} ·{' '}
              {stage === 'pictures'
                ? 'НАЗЫВАЕМ ПРЕДМЕТЫ'
                : stage === 'words'
                  ? 'ПЕРВЫЕ СЛОВА'
                  : levels[settings.unit].name}
            </small>
            <h1>{currentStage.title}</h1>
          </div>
          <span className="pill">
            <Star size={17} />
            {stars} <span className="desktop-word">звёзд</span>
          </span>
        </div>
        {!done && <TopicNavigation model={model} />}
        <LessonToolbar model={model} />
        <PracticeControls model={model} />
        {model.schedule.skips >= 2 && (
          <div className="rest-snooze" role="status">
            Разминку несколько раз пропустили. Сделать перерыв в напоминаниях?
            {[5, 10, 15].map((n) => (
              <button key={n} onClick={() => model.schedule.snooze(n)}>
                На {n} минут
              </button>
            ))}
          </div>
        )}
        {model.schedule.until > Date.now() && (
          <p className="muted">
            Напоминания об отдыхе временно выключены. «Пауза» доступна.
          </p>
        )}
        {model.schedule.due && (
          <p className="muted">После этого задания предложим отдохнуть.</p>
        )}
        <ExerciseCard model={model} />
        {done && <TopicNavigation model={model} />}
        <div className="foot">
          <Leaf size={16} />{' '}
          {settings.motion
            ? 'Движение включено · можно остановиться в любой момент'
            : 'Без спешки и таймера'}{' '}
          <span>·</span>{' '}
          {settings.breakMinutes
            ? `Отдых через ${settings.breakMinutes} минут занятия`
            : settings.breakEvery
              ? `Отдых через ${settings.breakEvery} заданий`
              : 'Отдых по кнопке «Пауза»'}
        </div>
      </section>
    </AppPortal>
  );
}
