import { ArrowRight, Mic, Square } from 'lucide-react';
import TaskInstruction from '../../components/task-instruction';
import EntryChoices from './EntryChoices';
import EntryProbe from './EntryProbe';
import type { EntryScreensProps } from './entry-screen-types';
export type {
  EntryScreensProps,
  EntryPage,
  EntryQuestion,
  EntryLearner,
} from './entry-screen-types';

const roles: [string, string][] = [
  ['child', 'Ребёнок сам'],
  ['parent', 'Взрослый о ребёнке'],
  ['self', 'Я о себе'],
];
const ages: [string, string][] = [
  ['under8', 'До 8 лет'],
  ['8to12', '8–12 лет'],
  ['13plus', '13 лет и старше'],
  ['unknown', 'Не указывать'],
];
const interests: [string, string][] = [
  ['technology', 'Техника'],
  ['videogames', 'Игры'],
  ['animals', 'Животные'],
  ['everyday', 'Обычная жизнь'],
];
const voiceHelp =
  'Можно отвечать голосом или нажимать на ответы. «Попробовать голосом» — проверим микрофон. «Отвечать нажатием» — выберем ответы кнопками. Нажми подходящий вариант.';
const micHelp =
  'Нажми кнопку с микрофоном и скажи «привет». Когда закончишь, нажми «Готово» со значком квадрата. Если не хочешь говорить, нажми «Без микрофона».';

export default function EntryScreens(props: EntryScreensProps) {
  const {
    page,
    answers,
    question,
    report,
    dispatch,
    busy,
    capturing,
    status,
    error,
  } = props;
  const child = answers.respondent === 'child';
  const answer = (id: string, value: string) =>
    dispatch('answer', { id, value });
  const titles: Record<string, string> = {
    role: 'Кто сейчас отвечает?',
    age: child
      ? 'Сколько тебе лет?'
      : answers.respondent === 'self'
        ? 'Сколько вам лет?'
        : 'Сколько лет ученику?',
    questions: question?.text ?? 'Знакомимся',
    interests: child ? 'Что тебе интересно?' : 'Что интересно?',
    access: 'Попробуем кнопки',
    voice: 'Как будем отвечать?',
    mic_trial: 'Попробуем микрофон',
    probe: 'Короткое знакомство',
    pause: 'Сделаем паузу?',
    report: 'Начнём отсюда',
  };
  const instructions: Record<string, string> = {
    interests:
      'Нажми на интересные картинки. Можно выбрать несколько. Затем нажми «Дальше». Если не хочешь выбирать, нажми «Пропустить».',
    access: 'Нажми на круг. Если нажимать неудобно, выбери «Нужна помощь».',
    voice: voiceHelp,
    mic_trial: micHelp,
    pause:
      'Всё сохранено. «Продолжить» — вернуться к заданиям. «Начать заниматься» — закончить знакомство и перейти к выбранному началу.',
    report: report
      ? `${report.title}. ${report.note}. ${report.nextGoals.join('. ')}. Нажми «Начать занятие».`
      : '',
  };
  return (
    <section
      className="entry08 lesson"
      aria-label="Первое знакомство"
      aria-busy={busy}
    >
      <header className="entry08-header">
        <p className="eyebrow">Читаем по шагам</p>
        <h1>{titles[page]}</h1>
      </header>
      <div className="entry08-card">
        {page !== 'probe' && (
          <TaskInstruction
            text={instructions[page] ?? titles[page]}
            sound
            speak={() => dispatch('instruction')}
          />
        )}
        {page === 'role' && (
          <EntryChoices
            rows={roles}
            dispatch={dispatch}
            busy={busy}
            onSelect={(value) => answer('respondent', value)}
          />
        )}
        {page === 'age' && (
          <EntryChoices
            rows={ages}
            dispatch={dispatch}
            busy={busy}
            onSelect={(value) => answer('age', value)}
          />
        )}
        {page === 'questions' && !child && question && (
          <>
            {question.number !== undefined && (
              <p className="entry08-progress">
                Вопрос {question.number} из {question.total ?? 8}
              </p>
            )}
            <EntryChoices
              rows={question.options}
              dispatch={dispatch}
              busy={busy}
              onSelect={(value) => answer(question.id, value)}
            />
            <button
              disabled={busy}
              onClick={() => answer(question.id, 'unknown')}
            >
              Пропустить
            </button>
          </>
        )}
        {page === 'interests' && (
          <>
            <EntryChoices
              rows={interests}
              dispatch={dispatch}
              busy={busy}
              multiple
              selected={
                Array.isArray(answers.interests)
                  ? (answers.interests as string[])
                  : []
              }
              onSelect={(value) => answer('interests', value)}
            />
            <div className="entry08-actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => dispatch('next')}
              >
                Дальше <ArrowRight size={18} />
              </button>
              <button disabled={busy} onClick={() => dispatch('skip')}>
                Пропустить
              </button>
            </div>
          </>
        )}
        {page === 'access' && (
          <>
            <div className="entry08-shapes">
              <button
                aria-label="Круг"
                className={props.accessHint ? 'entry08-shape-hint' : undefined}
                disabled={busy}
                onClick={() => dispatch('access', { shape: 'circle' })}
              >
                <span className="entry08-circle" />
              </button>
              <button
                aria-label="Квадрат"
                disabled={busy}
                onClick={() => dispatch('access', { shape: 'square' })}
              >
                <span className="entry08-square" />
              </button>
            </div>
            <button onClick={() => dispatch('access_help')}>
              Нужна помощь
            </button>
          </>
        )}
        {page === 'voice' && (
          <EntryChoices
            rows={[
              ['voice', 'Попробовать голосом'],
              ['buttons', 'Отвечать нажатием'],
            ]}
            dispatch={dispatch}
            busy={busy}
            onSelect={(value) => dispatch('input', { value })}
          />
        )}
        {page === 'mic_trial' && (
          <div className="entry08-actions">
            <button
              className="primary"
              disabled={busy && !capturing}
              onClick={() => dispatch(capturing ? 'mic_done' : 'mic_start')}
            >
              {capturing ? <Square size={20} /> : <Mic size={20} />}
              {capturing ? 'Готово' : 'Сказать'}
            </button>
            <button onClick={() => dispatch('mic_skip')}>Без микрофона</button>
          </div>
        )}
        {page === 'probe' && <EntryProbe {...props} />}
        {page === 'pause' && (
          <div className="entry08-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => dispatch('resume')}
            >
              Продолжить
            </button>
            <button disabled={busy} onClick={() => dispatch('finish')}>
              Начать заниматься
            </button>
          </div>
        )}
        {page === 'report' && report && (
          <div className="entry08-report">
            <h2>{report.title}</h2>
            <p>{report.note}</p>
            {!!report.strengths?.length && (
              <ul>
                {report.strengths.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
            <ol>
              {report.nextGoals.slice(0, 2).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
            <button
              className="primary"
              disabled={busy}
              onClick={() => dispatch('start_lesson')}
            >
              Начать занятие <ArrowRight size={18} />
            </button>
          </div>
        )}
        {status && (
          <p className="entry08-status" role="status">
            {status}
          </p>
        )}
        {error && (
          <p className="entry08-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
