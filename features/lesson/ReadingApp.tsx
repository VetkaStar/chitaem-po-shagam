'use client';
import { Leaf, Star } from 'lucide-react';
import { levels } from '@/lib/learning';
import { stages } from './config';
import { useLesson } from './use-lesson';
import ParentSettings from './ParentSettings';
import RestDialog from './RestDialog';
import MicrophoneConsent from './MicrophoneConsent';
import LessonHeader from './LessonHeader';
import LessonSidebar from './LessonSidebar';
import LessonToolbar from './LessonToolbar';
import ExerciseCard from './ExerciseCard';
import TopicNavigation from './TopicNavigation';
export default function ReadingApp() {
  const model = useLesson();
  const { settings, stage, currentStage, stars, done } = model;
  return (
    <main data-version="lab" className={settings.motion ? 'motion' : 'calm'}>
      <LessonHeader model={model} />
      <div className="shell">
        <LessonSidebar model={model} />
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
          <ExerciseCard model={model} />
          {done && <TopicNavigation model={model} />}
          <div className="foot">
            <Leaf size={16} />{' '}
            {settings.motion
              ? 'Движение включено · можно остановиться в любой момент'
              : 'Без спешки и таймера'}{' '}
            <span>·</span> {settings.breakEvery ? `Отдых через ${settings.breakEvery} заданий` : 'Отдых по кнопке «Пауза»'}
          </div>
        </section>
      </div>
      <ParentSettings model={model} />
      <RestDialog model={model} />
      <MicrophoneConsent model={model} />
    </main>
  );
}
