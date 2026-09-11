'use client';
import './practice.css';
import './vision.css';
import './bubble-layout.css';
import './rest-layout.css';
import AppPortal from '../portal/AppPortal';
import { Star } from 'lucide-react';
import { plural } from '@/lib/plural';
import { stages } from './config';
import { useLesson } from './use-lesson';
import LessonToolbar from './LessonToolbar';
import ExerciseCard from './ExerciseCard';
import PracticeControls from './PracticeControls';
import TopicNavigation from './TopicNavigation';
import FocusBar from './FocusBar';
// After the other lesson styles. app/globals.css still loads later (static-entry/main.tsx), so lesson.css scopes its rules to .lesson.
import './lesson.css';
import './focus.css';
export default function ReadingApp() {
  const model = useLesson();
  const { settings, stage, currentStage, stars } = model;
  return (
    <AppPortal model={model}>
      <section className="lesson">
        {settings.layout === 'focus' ? (
          <>
            <h1 className="sr-only">{currentStage.title}</h1>
            <FocusBar model={model} />
          </>
        ) : (
          <>
            <div className="lesson-top">
              <div className="lesson-title">
                <small>
                  ШАГ {stages.findIndex((s) => s.id === stage) + 1} ·{' '}
                  {stage === 'pictures'
                    ? 'НАЗЫВАЕМ ПРЕДМЕТЫ'
                    : stage === 'words'
                      ? 'ПЕРВЫЕ СЛОВА'
                      : currentStage.name.toUpperCase()}
                </small>
                <h1>{currentStage.title}</h1>
              </div>
              <span className="pill">
                <Star size={17} />
                {stars}{' '}
                <span className="desktop-word">
                  {plural(stars, ['звезда', 'звезды', 'звёзд'])}
                </span>
              </span>
            </div>
            <TopicNavigation model={model} />
          </>
        )}
        <div className="lesson-controls">
          <LessonToolbar model={model} />
          <PracticeControls model={model} />
        </div>
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
        {model.schedule.snoozed && (
          <p className="muted">
            Напоминания об отдыхе временно выключены. «Разминка» доступна.
          </p>
        )}
        {model.schedule.due && (
          <p className="muted">После этого задания предложим отдохнуть.</p>
        )}
        <ExerciseCard model={model} />
      </section>
    </AppPortal>
  );
}
