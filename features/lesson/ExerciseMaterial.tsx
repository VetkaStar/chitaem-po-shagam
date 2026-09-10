import ReadingGuide from './ReadingGuide';

import LetterDisplay from './LetterDisplay';

import { Check } from 'lucide-react';

import IllustrationGallery from '@/components/illustration-gallery';
import { wordIllustrations } from '@/content/illustrations';

import type { Dispatch, SetStateAction } from 'react';
import type { Stage, Mode, Settings, Feedback } from './config';

import type { ExerciseModel } from './exercise-types';
export default function ExerciseMaterial({
  mode,
  settings,
  flyCards,
  paused,
  parent,
  rest,
  done,
  stage,
  picture,
  scene,
  target,
  setScene,
  model,
  speechProgress,
  index,
  listening,
  feedback,
  displayWord,
  mistakes,
}: {
  mode: Mode;
  settings: Settings;
  flyCards: { id: number; text: string; caught: boolean }[];
  paused: boolean;
  parent: boolean;
  rest: boolean;
  done: boolean;
  stage: Stage;
  picture:
    | { word: string; icon: string; hint: string; accept?: undefined }
    | { word: string; icon: string; hint: string; accept: string[] }
    | null;
  scene: boolean;
  target: string;
  setScene: Dispatch<SetStateAction<boolean>>;
  model: ExerciseModel;
  speechProgress: number;
  index: number;
  listening: boolean;
  feedback: Feedback;
  displayWord: string;
  mistakes: number;
}) {
  return (
    <>
      {mode === 'fly' ? (
        <div
          className={'catch-game ' + (!settings.motion ? 'still' : '')}
          aria-label="Дорожки с карточками"
        >
          <div className="catch-instruction">Можно ловить в любом порядке</div>
          {flyCards.map((card, lane) => (
            <div className="catch-lane" key={lane}>
              <div
                key={card.id}
                className={'catch-token ' + (card.caught ? 'caught' : '')}
                data-token={card.text}
                style={{
                  animationDuration: `${(22 + lane * 5) / settings.flySpeed}s`,
                  animationDelay: `-${lane * 5}s`,
                  animationPlayState:
                    paused || parent || rest || done ? 'paused' : 'running',
                }}
              >
                {stage === 'letters' ? (
                  <LetterDisplay letter={card.text} settings={settings} />
                ) : (
                  <span>{card.text}</span>
                )}
                {card.caught && <Check size={23} />}
              </div>
            </div>
          ))}
        </div>
      ) : picture ? (
        <IllustrationGallery
          key={`${target}-${index}`}
          assetId={wordIllustrations[target]}
          concealAnswer
          context={scene}
          onContextChange={setScene}
        />
      ) : stage === 'words' && mode === 'read' ? (
        <div className="reading">
          <ReadingGuide
            text={target}
            color={settings.color}
            focus={
              model.showParts
                ? 'syllable'
                : settings.readingFocus === 'line'
                  ? 'word'
                  : settings.readingFocus
            }
            highlight={settings.readingHighlight}
            progress={Math.max(speechProgress, model.speechPreview)}
            selected={model.readingPart?.start}
            onSelect={model.selectReadingPart}
          />
        </div>
      ) : stage === 'letters' ? (
        <LetterDisplay letter={target} settings={settings} />
      ) : (
        <div
          className="reading"
          key={target + '-' + index}
          style={{
            animationPlayState:
              paused ||
              parent ||
              rest ||
              listening ||
              feedback.kind === 'success'
                ? 'paused'
                : 'running',
          }}
          aria-label={target}
        >
          {Array.from(displayWord).map((char, i) => (
            <span
              key={i}
              className={
                (char === '·'
                  ? 'syllable-gap'
                  : settings.color
                    ? /[АЕЁИОУЫЭЮЯ]/.test(char)
                      ? 'vowel'
                      : 'consonant'
                    : '') + (mistakes > 0 && i === 0 ? ' first-focus' : '')
              }
            >
              {char === '·' ? ' ' : char}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
