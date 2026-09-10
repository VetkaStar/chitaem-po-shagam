'use client';
import { nextTopic, topicNames } from '@/lib/topics';
import TopicBar from '@/components/topic-bar';
import type { Stage } from './config';
import type { LessonModel } from './use-lesson';
export default function TopicNavigation({
  model,
}: {
  model: Pick<
    LessonModel,
    'stage' | 'settings' | 'changeTopic' | 'done' | 'speak' | 'speaking'
  >;
}) {
  const { stage, settings, changeTopic, done, speak, speaking } = model;
  const next = nextTopic(stage, settings.unit);
  const current =
    stage === 'pictures' ? 'Называем картинки' : topicNames[settings.unit];
  return (
    <TopicBar
      unit={settings.unit}
      current={current}
      nextLabel={next.label}
      done={done}
      speaking={speaking}
      onPrevious={
        stage !== 'pictures' && settings.unit > 0
          ? () => changeTopic(stage, settings.unit - 1)
          : undefined
      }
      onSelect={
        stage !== 'pictures' ? (unit) => changeTopic(stage, unit) : undefined
      }
      onNext={() => changeTopic(next.stage as Stage, next.unit)}
      onSpeak={() =>
        speak(
          `Сейчас: ${current}. Следующая тема: ${next.label}. Нажми на стрелку, когда захочешь идти дальше.`,
        )
      }
    />
  );
}
