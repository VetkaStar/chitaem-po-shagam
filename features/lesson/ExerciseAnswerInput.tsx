import LetterSlots from './LetterSlots';

import { Volume2, Check } from 'lucide-react';

import { names } from './config';

import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { Stage, Mode, Settings, Feedback } from './config';
import type { TypoHint } from '@/lib/typo';

export default function ExerciseAnswerInput({
  mode,
  stage,
  settings,
  target,
  setFeedback,
  speak,
  speaking,
  picture,
  index,
  answer,
  setAnswer,
  submit,
  mistakes,
  feedback,
  paused,
  parent,
  rest,
  input,
  typo,
  setTypo,
}: {
  mode: Mode;
  stage: Stage;
  settings: Settings;
  target: string;
  setFeedback: Dispatch<SetStateAction<Feedback>>;
  speak: (text: string) => void;
  speaking: boolean;
  picture:
    | { word: string; icon: string; hint: string; accept?: undefined }
    | { word: string; icon: string; hint: string; accept: string[] }
    | null;
  index: number;
  answer: string;
  setAnswer: (value: string) => void;
  submit: () => void;
  mistakes: number;
  feedback: Feedback;
  paused: boolean;
  parent: boolean;
  rest: boolean;
  input: RefObject<HTMLInputElement | null>;
  typo: TypoHint | null;
  setTypo: Dispatch<SetStateAction<TypoHint | null>>;
}) {
  return (
    <>
      {mode === 'read' ? (
        <button
          className="sample"
          onClick={() =>
            stage === 'letters' &&
            settings.letterMode === 'sounds' &&
            !/[АОУЫИЭ]/.test(target)
              ? setFeedback({
                  kind: 'neutral',
                  text: 'Попроси взрослого показать звук. Образцы согласных ещё готовятся.',
                })
              : speak(
                  stage === 'letters' && settings.letterMode === 'alphabet'
                    ? names[target] || target
                    : target,
                )
          }
          disabled={speaking}
        >
          <Volume2 size={16} />
          {stage === 'letters'
            ? settings.letterMode === 'sounds'
              ? /[АОУЫИЭ]/.test(target)
                ? 'Послушать звук'
                : 'Как произнести звук'
              : 'Послушать название'
            : 'Послушать образец'}
        </button>
      ) : picture && settings.pictureMode === 'letters' ? (
        <LetterSlots
          vision={settings.colorVision}
          key={target + '-' + index}
          target={target}
          value={answer}
          onChange={setAnswer}
          onSubmit={submit}
          attempts={Math.max(0, mistakes - 1)}
          disabled={feedback.kind === 'success' || paused || parent || rest}
        />
      ) : (
        <form
          className="answer-form"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.repeat || e.nativeEvent.isComposing))
              e.preventDefault();
          }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            ref={input}
            aria-label="Твой ответ"
            value={answer}
            onChange={(e) => {
              if (typo) {
                setTypo(null);
                setFeedback({
                  kind: 'neutral',
                  text: 'Исправь и проверь ещё раз.',
                });
              }
              setAnswer(e.target.value);
              if (feedback.kind === 'error')
                setFeedback({
                  kind: 'neutral',
                  text: 'Попробуй ещё раз.',
                });
            }}
            disabled={feedback.kind === 'success' || paused || parent || rest}
            placeholder={
              mode === 'fly'
                ? 'Лови любой!'
                : stage === 'pictures'
                  ? 'Напиши слово'
                  : 'Напечатай здесь'
            }
            lang="ru"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
          />
          <button
            className="check-button"
            type="submit"
            disabled={!answer.trim() || feedback.kind === 'success'}
            aria-label="Проверить ответ"
          >
            <Check />
          </button>
        </form>
      )}
    </>
  );
}
