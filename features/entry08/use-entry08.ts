import { useEffect, useRef, useState } from 'react';
import type { CurriculumController } from '../curriculum/controller';
import type { Supply } from '../../lib/curriculum/types';
import type { Settings } from '../lesson/config';
import bank from '../../content/curriculum/lite-bank.json';
import { entry as E } from '../../lib/entry08/api';
import type { EntryState, EntryUi } from '../../lib/entry08/types';
import { migrateAnswers, questionPage } from '../../lib/entry08/migration';
import { entryHistory } from '../../lib/entry08/profile';
import * as P from '../../lib/entry08/personal';
import { createEntryMedia } from './media';
import { browserStorage } from '../../lib/progress/profile-storage';
import { parseProfile, profileKey } from '../portal/profile';

export function useEntry08(
  controller: CurriculumController,
  supply: Supply,
  settings: Settings,
  onExit: () => void,
  injectedMedia?: ReturnType<typeof createEntryMedia>,
) {
  const [state, setState] = useState(() => controller.snapshot());
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [status, setStatus] = useState(''),
    [capturing, setCapturing] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const mediaRef = useRef<ReturnType<typeof createEntryMedia> | null>(null);
  const media = (mediaRef.current ??=
    injectedMedia ?? createEntryMedia(() => settingsRef.current));
  const tail = useRef(Promise.resolve()),
    alive = useRef(true),
    generation = useRef(0);
  const snapshot = () => controller.snapshot();
  const current = () => snapshot().profile.entry08;
  const ui = () => snapshot().profile.entry08Ui!;
  const personal = () => {
    const p = snapshot().profile;
    return p.entry08 ? p.personalPath08?.[p.entry08.id] : undefined;
  };
  const save = async (update: {
    entry?: EntryState;
    ui?: EntryUi;
    personal?: P.PersonalRun;
  }) => {
    const s = snapshot();
    const next = await controller.saveEntry08(s.storageRevision, {
      ...update,
      ui: update.ui ?? s.profile.entry08Ui!,
    });
    if (alive.current) setState(next);
  };
  const queue = (fn: () => Promise<void>) => {
    if (alive.current) {
      setBusy(true);
      setError('');
    }
    const result = tail.current
      .then(fn)
      .catch((e: unknown) => {
        if (!alive.current || (e instanceof Error && e.message === 'ABORTED'))
          return;
        setError(
          e instanceof Error && e.message.includes('REVISION_CONFLICT')
            ? 'Сохранение изменилось в другой вкладке. Обнови страницу, чтобы продолжить.'
            : 'Не удалось выполнить действие. Попробуй ещё раз. Прогресс сохранён.',
        );
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
    tail.current = result;
    return result;
  };
  const halt = async () => {
    generation.current++;
    const e = current(),
      p = personal();
    try {
      if (e)
        await save({
          entry: E.cancelCapture(E.cancelAudio(e)),
          ...(p ? { personal: P.cancelPersonalMedia(p) } : {}),
        });
    } finally {
      media.stopSpeech();
      media.stopRecognition();
      if (alive.current) setCapturing(false);
    }
  };
  const advance = async (e: EntryState) => {
    const plan = E.nextScreen(e, bank);
    if (plan.kind === 'open') e = E.openCard(e, bank, plan);
    const page =
      plan.kind === 'pause'
        ? 'pause'
        : plan.kind === 'report'
          ? 'report'
          : plan.kind === 'access'
            ? 'access'
            : 'probe';
    await save({ entry: e, ui: { ...ui(), page } });
  };
  const ensureEntry = () =>
    current() ??
    E.createEntry(
      ui().answers,
      crypto.randomUUID(),
      entryHistory(snapshot().profile),
    );
  const simpleAudio = async (text: string) => {
    await halt();
    if (!alive.current || document.hidden) return;
    const epoch = generation.current;
    void media.speak(text).catch((e) => {
      if (
        alive.current &&
        epoch === generation.current &&
        e.message !== 'ABORTED'
      )
        setStatus(
          'Звук не включился. Проверь звук в настройках или продолжи без озвучки.',
        );
    });
  };
  const audio = async (scope: string, optionId?: string) => {
    await halt();
    const e = current();
    if (!e) return;
    const request = E.requestAudio(e, bank, {
      scope,
      optionId,
      userGesture: true,
    });
    const epoch = generation.current;
    await save({ entry: request.state });
    if (!alive.current || document.hidden || epoch !== generation.current)
      return;
    void media
      .speak(request.effect.text)
      .then(
        () => true,
        () => false,
      )
      .then((ok) =>
        queue(async () => {
          if (epoch !== generation.current || !alive.current) return;
          await save({
            entry: E.finishAudio(current()!, { ...request.effect, ok }),
          });
          if (!ok) setStatus('Звук не включился. Можно попробовать ещё раз.');
        }),
      );
  };
  const startMic = async (isPersonal = false) => {
    await halt();
    if (!alive.current || document.hidden) return;
    const epoch = generation.current,
      trial = ui().page === 'mic_trial',
      captureId = crypto.randomUUID();
    const instanceId = isPersonal
      ? personal()?.active?.instanceId
      : current()?.active?.instanceId;
    if (!trial) {
      if (isPersonal)
        await save({
          personal: P.startPersonalCapture(personal()!, captureId),
        });
      else await save({ entry: E.startCapture(current()!, captureId) });
    }
    if (!alive.current || epoch !== generation.current) return;
    setCapturing(true);
    setStatus('Готовим микрофон…');
    void media
      .recognize({
        onReady: () => {
          if (alive.current && epoch === generation.current)
            setStatus('Говори. Когда закончишь, нажми «Готово».');
        },
      })
      .then((result) =>
        queue(async () => {
          if (epoch !== generation.current || !alive.current) return;
          setCapturing(false);
          setStatus('');
          if (trial) {
            if (result.error || !result.transcript.trim()) {
              setStatus(E.speechIssue(result.error ?? 'no_speech').message);
              return;
            }
            await advance(
              E.accessReady(ensureEntry(), {
                voiceAvailable: true,
                voiceOptIn: true,
              }),
            );
          } else if (isPersonal) {
            await save({
              personal: P.answerPersonal(personal()!, supply.curriculum, {
                kind: 'speech',
                instanceId: instanceId!,
                captureId,
                value: result.transcript,
                isFinal: result.isFinal,
                confidence: result.confidence,
                error: result.error,
              }),
            });
            if (result.error) setStatus(E.speechIssue(result.error).message);
          } else
            await save({
              entry: E.submitSpeech(current()!, bank, {
                ...result,
                instanceId,
                captureId,
              }),
            });
        }),
      )
      .catch((e) => {
        if (
          alive.current &&
          epoch === generation.current &&
          e.message !== 'ABORTED'
        ) {
          setCapturing(false);
          setStatus('Микрофон недоступен. Можно отвечать нажатием.');
        }
      });
  };
  const personalAudio = async (
    scope: 'instruction' | 'target' | 'option',
    optionId?: string,
  ) => {
    await halt();
    const p = personal();
    if (!p) return;
    if (!p.active || p.paused) {
      await simpleAudio(P.personalView(p, supply.curriculum).instruction);
      return;
    }
    const request = P.requestPersonalAudio(p, supply.curriculum, {
      scope,
      optionId,
      userGesture: true,
    });
    const epoch = generation.current;
    await save({ personal: request.run });
    if (!alive.current || document.hidden || epoch !== generation.current)
      return;
    void media
      .speak(request.effect.text)
      .then(
        () => true,
        () => false,
      )
      .then((ok) =>
        queue(async () => {
          if (epoch !== generation.current || !alive.current) return;
          await save({
            personal: P.finishPersonalAudio(personal()!, {
              ...request.effect,
              ok,
            }),
          });
          if (!ok) setStatus('Звук не включился. Можно попробовать ещё раз.');
        }),
      );
  };
  const dispatch = (action: string, payload: Record<string, unknown> = {}) => {
    if (action === 'mic_done' || action === 'personal_mic_done') {
      media.finishRecognition();
      return;
    }
    void queue(async () => {
      setStatus('');
      if (action === 'personal_audio')
        return personalAudio(
          payload.scope as 'instruction' | 'target' | 'option',
          payload.optionId as string | undefined,
        );
      if (action === 'personal_mic_start') return startMic(true);
      if (action === 'personal_audio_stop' || action === 'audio_stop')
        return halt();
      if (action.startsWith('personal_')) {
        await halt();
        const p = personal();
        if (!p) return;
        if (action === 'personal_finish') {
          onExit();
          return;
        }
        if (action === 'personal_pause')
          return save({ personal: P.pausePersonal(p) });
        if (action === 'personal_resume')
          return save({
            personal: P.nextPersonal(p, supply.curriculum, { newVisit: true }),
          });
        if (action === 'personal_next')
          return save({ personal: P.nextPersonal(p, supply.curriculum) });
        if (action === 'personal_continue')
          return save({
            personal: P.nextPersonal(p, supply.curriculum, {
              continueEpisode: true,
              acceptProposed: !!p.proposedNodeId,
            }),
          });
        if (action === 'personal_answer')
          return save({
            personal: P.answerPersonal(p, supply.curriculum, {
              ...payload,
              instanceId: p.active!.instanceId,
            } as P.PersonalAnswer),
          });
        return;
      }
      if (action === 'mic_start') return startMic();
      if (action === 'target_audio') return audio('target');
      if (action === 'option_audio')
        return current()?.active && ui().page === 'probe'
          ? audio('option', String(payload.id))
          : simpleAudio(String(payload.text ?? ''));
      if (action === 'feedback_audio')
        return simpleAudio(String(payload.text ?? ''));
      if (action === 'instruction') {
        if (ui().page === 'probe') return audio('instruction');
        return simpleAudio(instructionFor(ui()));
      }
      if (action === 'how_answer')
        return simpleAudio(
          'Для ответа голосом нажми микрофон, прочитай и нажми «Готово». Можно послушать образец, попросить помощь или пропустить. На вопрос нажми подходящий ответ.',
        );
      await halt();
      if (action === 'exit') {
        onExit();
        return;
      }
      const u = ui();
      let e = current();
      if (action === 'answer') {
        const answers = { ...u.answers },
          id = String(payload.id),
          value = String(payload.value);
        if (id === 'interests') {
          const values = Array.isArray(answers.interests)
            ? (answers.interests as string[])
            : [];
          answers.interests = values.includes(value)
            ? values.filter((x) => x !== value)
            : [...values, value];
          return save({ ui: { ...u, answers } });
        }
        answers[id] = value;
        return save({ ui: { ...u, answers, page: questionPage(answers) } });
      }
      if ((action === 'next' || action === 'skip') && u.page === 'interests')
        return save({
          ui: {
            ...u,
            answers: { ...u.answers, interests: u.answers.interests ?? [] },
            page: 'access',
          },
        });
      if (
        action === 'access_help' ||
        (action === 'access' && payload.shape !== 'circle')
      )
        return save({ ui: { ...u, accessHint: true } });
      if (action === 'access') {
        e = ensureEntry();
        if (e.config.input === 'buttons')
          return advance(
            E.accessReady(e, { voiceAvailable: false, voiceOptIn: false }),
          );
        return save({
          entry: e,
          ui: { ...u, page: u.answers.input ? 'mic_trial' : 'voice' },
        });
      }
      if (action === 'voice_options')
        return save({ ui: { ...u, page: 'voice' } });
      if (action === 'mic_retry')
        return save({ ui: { ...u, page: 'mic_trial' } });
      if (action === 'input' || action === 'mic_skip') {
        const input = action === 'mic_skip' ? 'buttons' : String(payload.value);
        e = E.updateInputMode(ensureEntry(), bank, input);
        const updated = { ...u, answers: { ...u.answers, input } };
        if (input === 'buttons') {
          await save({ entry: e, ui: updated });
          return advance(
            E.accessReady(e, { voiceAvailable: false, voiceOptIn: false }),
          );
        }
        return save({ entry: e, ui: { ...updated, page: 'mic_trial' } });
      }
      if (!e) return;
      if (action === 'pause')
        return save({ entry: E.pause(e), ui: { ...u, page: 'pause' } });
      if (action === 'resume') return advance(E.resume(e));
      if (action === 'finish') {
        if (e.active && e.active.phase !== 'feedback') e = E.skip(e, bank);
        return save({ entry: E.finishNow(e), ui: { ...u, page: 'report' } });
      }
      if (action === 'next') return advance(E.next(e));
      if (action === 'help') return save({ entry: E.showHint(e, bank) });
      if (action === 'difficulty')
        return save({ entry: E.difficulty(e, bank) });
      if (action === 'skip') return save({ entry: E.skip(e, bank) });
      if (action === 'choose')
        return save({
          entry: E.submitChoice(e, bank, {
            instanceId: e.active!.instanceId,
            optionId: payload.id,
            via: 'button',
          }),
        });
      if (action === 'adult_result')
        return save({
          entry: E.submitCompanion(e, bank, {
            instanceId: e.active!.instanceId,
            correct: payload.correct,
            actor: 'adult',
          }),
        });
      if (action === 'start_lesson') {
        const run = P.startPersonal(
          e,
          bank,
          supply.curriculum,
          snapshot().profile as unknown as Record<string, unknown>,
        );
        return save({ personal: run, ui: { ...u, page: 'lesson' } });
      }
    });
  };
  useEffect(() => {
    alive.current = true;
    void queue(async () => {
      const s = snapshot(),
        answers = migrateAnswers(
          s,
          parseProfile(browserStorage.getItem(profileKey))?.age,
        );
      let e = s.profile.entry08 ? E.upgradeEntry(s.profile.entry08) : undefined;
      let savedUi: EntryUi = s.profile.entry08Ui ?? {
        version: '0.8.1',
        answers,
        page: questionPage(answers),
      };
      const p = e ? s.profile.personalPath08?.[e.id] : undefined;
      if (e && !s.profile.entry08Ui) {
        const plan = E.nextScreen(e, bank);
        if (plan.kind === 'open') e = E.openCard(e, bank, plan);
        savedUi = {
          version: '0.8.1',
          answers: { ...e.config },
          page: p
            ? 'lesson'
            : plan.kind === 'report'
              ? 'report'
              : plan.kind === 'pause'
                ? 'pause'
                : plan.kind === 'access'
                  ? 'access'
                  : 'probe',
        };
      }
      const recovered =
        p && e
          ? p.version === '0.8.1' && p.cursor
            ? P.cancelPersonalMedia(p)
            : P.startPersonal(
                e,
                bank,
                supply.curriculum,
                s.profile as unknown as Record<string, unknown>,
              )
          : undefined;
      await save({
        ui: savedUi,
        ...(e ? { entry: e } : {}),
        ...(recovered ? { personal: recovered } : {}),
      });
    });
    const leaving = () => {
      generation.current++;
      media.stopSpeech();
      media.stopRecognition();
      void queue(halt);
    };
    const hidden = () => {
      if (document.hidden) leaving();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', leaving);
    return () => {
      alive.current = false;
      generation.current++;
      media.stopSpeech();
      media.stopRecognition();
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', leaving);
      void queue(halt).finally(() => {
        media.stopSpeech();
        media.stopRecognition();
      });
    };
  }, [controller]);
  const s = state.profile,
    u = s.entry08Ui,
    e = s.entry08,
    p = e ? s.personalPath08?.[e.id] : undefined;
  return {
    ui: u,
    entry: e,
    personal: p,
    view: p ? P.personalView(p, supply.curriculum) : null,
    learner: e ? E.learnerView(e, bank) : null,
    report: e ? E.report(e, bank) : null,
    question: u ? E.questionnaireFor(u.answers)[0] : null,
    busy,
    error,
    status,
    capturing,
    dispatch,
  };
}

function instructionFor(ui: EntryUi) {
  const fixed: Partial<Record<EntryUi['page'], string>> = {
    role: 'Кто сейчас отвечает? Взрослый о ребёнке, я о себе или ребёнок сам. Нажми подходящий вариант.',
    age: 'Выбери возраст: до восьми лет, от восьми до двенадцати, тринадцать лет и старше. Можно не указывать.',
    interests:
      'Нажми интересные картинки. Можно выбрать несколько. Затем нажми «Дальше». Можно пропустить.',
    access: 'Нажми на круг. Если нажимать неудобно, выбери «Нужна помощь».',
    voice:
      'Можно отвечать голосом или нажимать на ответы. «Попробовать голосом» — проверим микрофон. «Отвечать нажатием» — выберем ответы кнопками. Нажми подходящий вариант.',
    mic_trial:
      'Нажми кнопку с микрофоном и скажи «привет». Когда закончишь, нажми «Готово» со значком квадрата. Если не хочешь говорить, нажми «Без микрофона».',
    pause: 'Всё сохранено. Можно продолжить знакомство или начать заниматься.',
    report: 'Мы подобрали начало. Нажми «Начать занятие».',
  };
  const q = E.questionnaireFor(ui.answers)[0];
  return (
    fixed[ui.page] ??
    (q
      ? `${q.text} ${q.options.map((x) => x[1]).join('. ')}`
      : 'Нажми подходящую кнопку.')
  );
}
