'use client';
import type { SpeechController } from './lesson-speech-types';
import { restoreLessonProgress } from './lesson-storage';

import { createSpeechHandler } from './lesson-speech-actions';
import { createAnswerHandler } from './lesson-answer-actions';
import { createCatchHandler } from './lesson-catch-actions';
import { createVoiceHandler } from './lesson-voice-actions';
import { createReportExporter } from './lesson-report';

import { pictureRetry } from '@/lib/picture-retry';

import { useRestSchedule } from './use-rest-schedule';
import { freshWordDeck, wordParts } from '@/content/word-bank';
import { useEffect, useRef, useState } from 'react';
import { levels, pictures, breaks } from '@/lib/learning';
import { wordPool, makeDeck } from '@/lib/session';
import { SlowReadingAttempt, matchFragment } from '@/lib/slow-reading';
import { findTypo, type TypoHint } from '@/lib/typo';

import { startLocalSpeech, type SpeechCallbacks } from '@/lib/local-speech';
import {
  Stage,
  Mode,
  Feedback,
  Settings,
  Entry,
  defaults,
  stages,
  names,
} from './config';
export function useLesson() {
  const [stage, setStage] = useState<Stage>('syllables'),
    [mode, setMode] = useState<Mode>('read'),
    [settings, setSettings] = useState(defaults),
    [ready, setReady] = useState(false),
    [storageWarning, setStorageWarning] = useState('');
  const [lessonActive, setLessonActive] = useState(false);
  const [recentWords, setRecentWords] = useState<string[]>([]);
  const [partsHelp, setPartsHelp] = useState(false),
    [wholeAgain, setWholeAgain] = useState(false);
  const [index, setIndex] = useState(0),
    [count, setCount] = useState(0),
    [stars, setStars] = useState(0),
    [history, setHistory] = useState<Entry[]>([]),
    [answer, setAnswer] = useState(''),
    [feedback, setFeedback] = useState<Feedback>({
      kind: 'neutral',
      text: 'Не спеши. У тебя получится.',
    });
  const [parent, setParent] = useState(false),
    [paused, setPaused] = useState(false),
    [rest, setRest] = useState(false),
    [done, setDone] = useState(false),
    [, setRestIndex] = useState(0),
    [hint, setHint] = useState(false),
    [listening, setListening] = useState(false),
    [supported, setSupported] = useState(false),
    [consent, setConsent] = useState(false),
    [heard, setHeard] = useState(''),
    [speaking, setSpeaking] = useState(false);
  const [loadingSpeech, setLoadingSpeech] = useState(false),
    [micLevel, setMicLevel] = useState(0),
    [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]),
    [micTesting, setMicTesting] = useState(false),
    [micMessage, setMicMessage] = useState(
      'Выбери микрофон и проверь: полоска должна двигаться, когда ты говоришь.',
    );
  const [lessonMic, setLessonMic] = useState(false),
    [cooldown, setCooldown] = useState(false),
    [mistakes, setMistakes] = useState(0),
    [spectrum, setSpectrum] = useState<number[]>(Array(12).fill(0));
  const [flyCards, setFlyCards] = useState<
      { id: number; text: string; caught: boolean }[]
    >([]),
    [flyInputStatus, setFlyInputStatus] = useState('');
  const flyNext = useRef(3),
    caughtIds = useRef(new Set<number>());
  const resultSink = useRef<SpeechCallbacks['onResult']>(() => {}),
    helpLock = useRef(false),
    speechEpoch = useRef(0);
  const input = useRef<HTMLInputElement>(null),
    recognition = useRef<SpeechController | null>(null),
    epoch = useRef(0),
    awarded = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true);
  const unclearAttempts = useRef(0);
  const [readingPart, setReadingPart] = useState<{
    text: string;
    start: number;
  } | null>(null);
  const selectedPartRef = useRef(readingPart);
  selectedPartRef.current = readingPart;
  const [repeatEpoch, setRepeatEpoch] = useState(0);
  const repeatReward = useRef(false);
  const partPractice = useRef(new SlowReadingAttempt());
  const slowAttempt = useRef(new SlowReadingAttempt());
  const [speechPreview, setSpeechPreview] = useState(0);
  const [speechProgress, setSpeechProgress] = useState(0),
    [attemptStatus, setAttemptStatus] = useState('');
  const activitySink = useRef<(phase: 'sound' | 'pause') => void>(() => {});
  const [typo, setTypo] = useState<TypoHint | null>(null);
  const [deck, setDeck] = useState<string[]>([]),
    [session, setSession] = useState(0),
    [scene, setScene] = useState(false);
  const schedule = useRestSchedule(
    lessonActive && !parent && !paused && !rest && !done,
    settings.breakEvery,
    settings.breakMinutes,
  );
  const wantsParts =
    stage === 'words' &&
    mode === 'read' &&
    !wholeAgain &&
    (settings.wordMode === 'parts' || settings.partsThenWhole || partsHelp);
  const pool =
    stage === 'pictures'
      ? pictures.map((x) => x.word)
      : stage === 'words'
        ? wordPool(settings.unit)
        : levels[settings.unit][stage];
  const target = deck[index % Math.max(1, deck.length)] || pool[0],
    picture =
      stage === 'pictures'
        ? (pictures.find((p) => p.word === target) ?? null)
        : null;
  const lessonLength =
    stage === 'words' && mode !== 'fly'
      ? Math.min(settings.length, new Set(pool).size)
      : settings.length;
  const showParts = wantsParts && wordParts(target).length > 1;
  useEffect(() => {
    if (ready)
      setDeck((old) =>
        stage === 'words'
          ? freshWordDeck(pool, Math.max(24, settings.length), recentWords)
          : makeDeck(pool, Math.max(24, settings.length), old),
      );
  }, [ready, stage, mode, settings.unit, session]);
  useEffect(() => {
    if (ready && lessonActive && !done && stage === 'words' && target)
      setRecentWords((h) =>
        h.at(-1) === target
          ? h
          : [...h.filter((w) => w !== target), target].slice(-200),
      );
  }, [ready, lessonActive, done, stage, target, index]);
  const task =
    stage === 'pictures'
      ? 'Напиши, что на картинке'
      : mode === 'read'
        ? stage === 'letters'
          ? settings.letterMode === 'sounds'
            ? 'Произнеси звук'
            : 'Назови букву'
          : stage === 'syllables'
            ? 'Прочитай слог вслух'
            : 'Прочитай слово вслух'
        : mode === 'fly'
          ? 'Поймай: напечатай любой и нажми Enter'
          : stage === 'letters'
            ? 'Напечатай букву'
            : stage === 'syllables'
              ? 'Напечатай слог'
              : 'Напечатай слово';
  function stop() {
    slowAttempt.current.reset();
    setSpeechPreview(0);
    setSpeechProgress(0);
    setAttemptStatus('');
    epoch.current++;
    speechEpoch.current++;
    helpLock.current = false;
    setCooldown(false);
    setSpectrum(Array(12).fill(0));
    if (timer.current) clearTimeout(timer.current);
    try {
      recognition.current?.abort();
    } catch {}
    recognition.current = null;
    setListening(false);
    setLoadingSpeech(false);
    setMicLevel(0);
    setMicTesting(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window)
      window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  function resetCard() {
    setReadingPart(null);
    partPractice.current.reset();
    unclearAttempts.current = 0;
    setPartsHelp(false);
    setWholeAgain(false);
    setTypo(null);
    setScene(false);
    stop();
    awarded.current = false;
    setAnswer('');
    setHint(false);
    setHeard('');
    setMistakes(0);
    setFeedback({ kind: 'neutral', text: 'Не спеши. У тебя получится.' });
  }
  function changeTopic(s: Stage, unit: number) {
    if (!Number.isInteger(unit) || unit < 0 || unit >= levels.length) return;
    if (s === stage && unit === settings.unit) return;
    const keepMic = lessonMic && mode === 'read' && s !== 'pictures';
    setSettings((value) => ({ ...value, unit }));
    navigate(s, stage === 'pictures' && s !== 'pictures' ? 'read' : mode);
    setDeck([]);
    setLessonMic(keepMic);
  }
  function navigate(s: Stage, m: Mode = mode) {
    setSession((n) => n + 1);
    setFlyInputStatus('');
    repeatReward.current = false;
    setLessonMic(lessonMic && m === 'read' && s !== 'pictures');
    resetCard();
    setStage(s);
    setMode(s === 'pictures' ? 'type' : m);
    setCount(0);
    setIndex(0);
    setDone(false);
    setRest(false);
    setPaused(false);
  }
  useEffect(() => {
    mounted.current = true;
    setSupported(
      Boolean(
        typeof navigator.mediaDevices?.getUserMedia === 'function' &&
        typeof window.AudioContext === 'function' &&
        typeof window.WebAssembly === 'object',
      ),
    );
    void navigator.mediaDevices
      ?.enumerateDevices()
      .then((d) => setMicDevices(d.filter((x) => x.kind === 'audioinput')))
      .catch(() => {});
    restoreLessonProgress({
      setSettings,
      setRecentWords,
      setStars,
      setHistory,
      setStorageWarning,
    });
    setReady(true);
    return () => {
      mounted.current = false;
      epoch.current++;
      try {
        recognition.current?.abort();
      } catch {}
      if (timer.current) clearTimeout(timer.current);
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        'reading-steps-v3',
        JSON.stringify({ settings, stars, history, recentWords }),
      );
    } catch {
      setStorageWarning('Не удалось сохранить результаты на этом устройстве.');
    }
  }, [settings, stars, history, recentWords, ready]);
  useEffect(() => {
    function hide() {
      if (document.hidden) {
        schedule.suspend();
        stop();
        setLessonMic(false);
      }
    }
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!parent && !paused && !rest && !done && mode !== 'read')
      input.current?.focus({ preventScroll: true });
  }, [index, mode, parent, paused, rest, done, stage]);
  function record(result: string, via: string) {
    setHistory((h) =>
      [
        ...h,
        { at: new Date().toISOString(), target, stage, mode, result, via },
      ].slice(-300),
    );
  }
  function success(via: string) {
    setTypo(null);
    if (awarded.current) return;
    if (
      showParts &&
      (settings.partsThenWhole || settings.wordMode === 'parts' || partsHelp)
    ) {
      setWholeAgain(true);
      setPartsHelp(false);
      slowAttempt.current.reset();
      setSpeechProgress(0);
      setHeard('');
      setMistakes(0);
      setHint(false);
      setFeedback({
        kind: 'neutral',
        text: 'Молодец, слоги получились! А теперь прочитай слово целиком.',
      });
      record('parts-complete', via);
      if (settings.autoSpeech)
        speak('Молодец! А теперь прочитай слово целиком.');
      return;
    }
    awarded.current = true;
    setReadingPart(null);
    setSpeechPreview(0);
    setSpeechProgress(target.length);
    recognition.current?.setEnabled?.(false);
    setFeedback({ kind: 'success', text: `Верно! ${target}. Получилось!` });
    setHeard('');
    if (!repeatReward.current) setStars((n) => n + 1);
    record(repeatReward.current ? 'repeat-success' : 'success', via);
    if (mode === 'read' && settings.sound && settings.autoSpeech)
      speak(`Верно! ${target.toLowerCase()}.`);
  }
  function releaseSoon(delay = 650) {
    if (timer.current) clearTimeout(timer.current);
    const token = epoch.current;
    timer.current = setTimeout(() => {
      if (epoch.current !== token) return;
      helpLock.current = false;
      setCooldown(false);
    }, delay);
  }
  const speak = createVoiceHandler({
    setCooldown,
    recognition,
    speechEpoch,
    settings,
    releaseSoon,
    setSpeaking,
  });
  function wrongResponse(value: string, via: string) {
    if (awarded.current || helpLock.current) return;
    helpLock.current = true;
    recognition.current?.setEnabled?.(false);
    setCooldown(true);
    const attempt = mistakes + 1;
    setMistakes(attempt);
    if (stage === 'words' && attempt >= 2 && !wholeAgain) setPartsHelp(true);
    setHeard(value);
    setHint(true);
    record('retry', via);
    const prompt =
      attempt === 1
        ? `Здесь ${target}. Начни с первой буквы.`
        : attempt === 2
          ? `Давай вместе: ${target}. Послушай и повтори.`
          : `Сначала найди ${target}. Потом прочитай.`;
    setFeedback({ kind: 'error', text: prompt });
    if (settings.sound && settings.autoSpeech && mode === 'read')
      speak(
        attempt === 1
          ? `Здесь ${target.toLowerCase()}. Попробуй ещё раз.`
          : attempt === 2
            ? `Послушай. ${target.toLowerCase()}. Теперь ты.`
            : `Найди такой же слог. ${target.toLowerCase()}.`,
      );
    else releaseSoon(1200);
  }
  const handleSpeech = createSpeechHandler({
    awarded,
    helpLock,
    speaking,
    parent,
    paused,
    rest,
    done,
    setSpeechPreview,
    stage,
    settings,
    target,
    setFeedback,
    stop,
    setPaused,
    readingPart,
    partPractice,
    setReadingPart,
    success,
    slowAttempt,
    setSpeechProgress,
    setAttemptStatus,
    wrongResponse,
    setHeard,
  });
  activitySink.current = (phase) => {
    if (
      awarded.current ||
      helpLock.current ||
      speaking ||
      parent ||
      paused ||
      rest ||
      done ||
      loadingSpeech
    )
      return;
    if (phase === 'sound') {
      schedule.touch();
      setAttemptStatus('Слышу звук. Читай в своём темпе.');
    } else {
      if (
        stage === 'words' &&
        !slowAttempt.current.progress &&
        !wholeAgain &&
        ++unclearAttempts.current >= 2
      )
        setPartsHelp(true);
      setAttemptStatus(
        slowAttempt.current.progress
          ? 'Начало услышано. Продолжай, я жду.'
          : 'Попытка услышана, но слово пока не распознано. Попробуй ещё раз или послушай образец.',
      );
    }
  };
  resultSink.current = handleSpeech;
  function listen() {
    if (lessonMic) {
      setLessonMic(false);
      stop();
      return;
    }
    if (!settings.micConsent) {
      setConsent(true);
      return;
    }
    setLessonMic(true);
  }
  useEffect(() => {
    if (
      !lessonMic ||
      !settings.micConsent ||
      mode !== 'read' ||
      parent ||
      paused ||
      rest ||
      done
    )
      return;
    stop();
    const token = epoch.current;
    setListening(true);
    setLoadingSpeech(true);
    recognition.current = startLocalSpeech({
      deviceId: settings.micDevice,
      vocabulary: [
        ...wordPool(levels.length - 1),
        ...levels.flatMap((l) => [
          ...(stage === 'letters'
            ? l.letters.map((x) =>
                settings.letterMode === 'alphabet' ? names[x] || x : x,
              )
            : []),
          ...l.syllables,
          ...l.words,
        ]),
        ...pictures.map((p) => p.word),
        'нет',
        'да',
        'привет',
        'ошибка',
        'я не хочу',
        'я не буду',
        'не надо',
        'хватит',
        'я устал',
        'я устала',
        'стоп',
        'хочу отдохнуть',
      ],
      onLevel: (v) => {
        if (epoch.current === token) setMicLevel(v);
      },
      onSpectrum: (v) => {
        if (epoch.current === token) setSpectrum(v);
      },
      onStatus: (text) => {
        if (epoch.current === token && !awarded.current)
          setFeedback({ kind: 'neutral', text });
      },
      onReady: () => {
        if (epoch.current !== token) return;
        setLoadingSpeech(false);
        if (!awarded.current)
          setFeedback({
            kind: 'neutral',
            text: 'Я слушаю. Прочитай и сделай паузу.',
          });
        void navigator.mediaDevices
          .enumerateDevices()
          .then((d) => setMicDevices(d.filter((x) => x.kind === 'audioinput')))
          .catch(() => {});
      },
      onActivity: (phase) => {
        if (epoch.current === token) activitySink.current(phase);
      },
      onPartial: (text) => {
        if (epoch.current === token) {
          activitySink.current('sound');
          if (stage === 'words')
            setSpeechPreview(
              matchFragment(
                text,
                target,
                selectedPartRef.current
                  ? selectedPartRef.current.start +
                      partPractice.current.progress
                  : slowAttempt.current.progress,
              ) ??
                matchFragment(text, target) ??
                0,
            );
        }
      },
      onResult: (r) => {
        if (epoch.current === token && mounted.current) resultSink.current(r);
      },
      onError: (text) => {
        if (epoch.current !== token) return;
        setLessonMic(false);
        setListening(false);
        setLoadingSpeech(false);
        setFeedback({ kind: 'uncertain', text });
      },
    });
    return () => stop();
  }, [
    lessonMic,
    settings.micConsent,
    index,
    stage,
    mode,
    parent,
    paused,
    rest,
    done,
    settings.unit,
    settings.micDevice,
    settings.letterMode,
    settings.wordMode,
    repeatEpoch,
  ]);
  useEffect(() => {
    recognition.current?.setEnabled?.(
      !speaking &&
        !cooldown &&
        feedback.kind !== 'success' &&
        !parent &&
        !paused &&
        !rest &&
        !done,
    );
  }, [
    speaking,
    cooldown,
    feedback.kind,
    parent,
    paused,
    rest,
    done,
    listening,
    loadingSpeech,
  ]);
  async function testMic() {
    if (micTesting) {
      stop();
      setMicMessage('Проверка остановлена.');
      return;
    }
    stop();
    const token = epoch.current;
    let stream: MediaStream | undefined,
      ctx: AudioContext | undefined,
      frame = 0;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
      if (ctx && ctx.state !== 'closed') void ctx.close();
    };
    recognition.current = { abort: cleanup };
    try {
      ctx = new AudioContext();
      await ctx.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: settings.micDevice
            ? { exact: settings.micDevice }
            : undefined,
        },
        video: false,
      });
      if (epoch.current !== token) {
        cleanup();
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (epoch.current !== token) {
        cleanup();
        return;
      }
      setMicDevices(devices.filter((x) => x.kind === 'audioinput'));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(512);
      setMicTesting(true);
      setMicMessage(
        'Скажи что-нибудь. Полоска показывает реальный звук микрофона.',
      );
      let last = 0;
      const tick = () => {
        if (epoch.current !== token) return;
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += v * v;
        if (performance.now() - last > 80) {
          setMicLevel(Math.min(1, Math.sqrt(sum / data.length) * 8));
          last = performance.now();
        }
        frame = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      cleanup();
      setMicTesting(false);
      setMicMessage(
        (e as Error).name === 'NotAllowedError'
          ? 'Доступ запрещён. Разреши микрофон в настройках этого сайта.'
          : 'Не удалось открыть микрофон. Выбери другое устройство.',
      );
    }
  }

  useEffect(() => {
    if (mode !== 'fly' || done) return;
    caughtIds.current.clear();
    flyNext.current = 3;
    setFlyCards(
      Array.from({ length: 3 }, (_, i) => ({
        id: i,
        text: (deck.length ? deck : pool)[i % (deck.length || pool.length)],
        caught: false,
      })),
    );
    setFlyInputStatus('Напечатай любую карточку, которую видишь.');
  }, [mode, stage, settings.unit, done, deck]);
  useEffect(() => {
    if (mode !== 'fly' || paused || rest || parent || done) return;
    const caught = flyCards.filter((c) => c.caught);
    if (!caught.length) return;
    const t = setTimeout(() => {
      setFlyCards((cards) =>
        cards.map((c) => {
          if (!caught.some((x) => x.id === c.id)) return c;
          const id = flyNext.current++;
          return {
            id,
            text: pool[Math.floor(Math.random() * pool.length)],
            caught: false,
          };
        }),
      );
    }, 1000);
    return () => clearTimeout(t);
  }, [flyCards, mode, paused, rest, parent, done]);
  const catchCard = createCatchHandler({
    stage,
    mode,
    answer,
    paused,
    rest,
    done,
    flyCards,
    caughtIds,
    setFlyInputStatus,
    setFlyCards,
    setAnswer,
    setStars,
    setHistory,
    count,
    setCount,
    settings,
    setDone,
    schedule,
    setRestIndex,
    setRest,
  });
  function showTypo() {
    const correction = findTypo(answer, target, []);
    if (!correction) return false;
    setTypo(correction);
    setHint(false);
    setHeard('');
    setFeedback({ kind: 'neutral', text: correction.message });
    record('spelling-help', 'typed');
    if (settings.sound && settings.autoSpeech) speak(correction.message);
    return true;
  }
  function pictureMiss(slots: boolean) {
    const attempt = mistakes + 1;
    setMistakes(attempt);
    const help = pictureRetry(
      attempt,
      target,
      slots,
      settings.colorVision !== 'off',
    );
    setHint(help.hint);
    if (help.scene) setScene(true);
    setHeard('');
    setFeedback({ kind: 'neutral', text: help.message });
    record(attempt === 1 ? 'retry' : 'help', slots ? 'slots' : 'typed');
    if (settings.sound && settings.autoSpeech) speak(help.message);
  }
  const submit = createAnswerHandler({
    setTypo,
    mode,
    catchCard,
    awarded,
    answer,
    schedule,
    setFeedback,
    picture,
    target,
    settings,
    showTypo,
    record,
    speak,
    pictureMiss,
    success,
    setHint,
    setHeard,
    setScene,
    wrongResponse,
  });
  function repeatExercise() {
    if (done) return;
    repeatReward.current = repeatReward.current || awarded.current;
    record('repeat', 'manual');
    resetCard();
    setRepeatEpoch((n) => n + 1);
    if (mode === 'fly') {
      caughtIds.current.clear();
      setFlyCards((cards) =>
        cards.map((card) => ({
          ...card,
          id: flyNext.current++,
          caught: false,
        })),
      );
      setFlyInputStatus('Попробуй эти карточки ещё раз.');
    }
  }
  function next(skip = false) {
    if (!skip && !awarded.current) return;
    if (skip && !awarded.current) record('skipped', 'manual');
    const nextCount = count + 1;
    repeatReward.current = false;
    resetCard();
    setIndex((i) => i + 1);
    setCount(nextCount);
    if (nextCount >= lessonLength) setDone(true);
    else if (schedule.shouldRest(nextCount, lessonLength)) {
      setRest(true);
      setRestIndex((i) => (i + 1) % breaks.length);
    }
  }
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === 'micConsent' && !value) {
      setLessonMic(false);
      stop();
    }
    if (
      key === 'pictureMode' ||
      key === 'wordMode' ||
      key === 'letterMode' ||
      key === 'partsThenWhole'
    ) {
      if (!awarded.current) resetCard();
    }
    if (key === 'unit' || key === 'length') {
      repeatReward.current = false;
      setSession((n) => n + 1);
      resetCard();
      setIndex(0);
      setCount(0);
      setDone(false);
      setRest(false);
    }
    setSettings((s) => ({ ...s, [key]: value }));
  }
  const exportReport = createReportExporter({ history });
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool?: (
            tool: object,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'get_reading_activity',
            description:
              'Read the current exercise and session progress without changing it.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: (v: unknown) => {
              if (v === null || typeof v !== 'object' || Object.keys(v).length)
                throw Error('Expected an empty object');
              return {
                stage,
                mode,
                target,
                completed: count,
                total: settings.length,
                paused: paused || rest || parent,
                finished: done,
              };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [stage, mode, target, count, settings.length, paused, rest, parent, done]);
  const currentStage = stages.find((s) => s.id === stage)!;

  function awardReadingText(
    id: string,
    title: string,
    practice: 'read' | 'write' | 'questions' = 'questions',
  ) {
    setStars((n) => n + 1);
    setHistory((h) =>
      [
        ...h,
        {
          at: new Date().toISOString(),
          target: title,
          stage: 'words' as Stage,
          mode: (practice === 'write' ? 'type' : 'read') as Mode,
          result:
            practice === 'questions' ? 'comprehension' : 'text-' + practice,
          via: id,
        },
      ].slice(-300),
    );
  }
  function continueLesson() {
    if (
      stage === 'words' &&
      pool.length <= settings.length &&
      settings.unit < levels.length - 1
    ) {
      const later = levels.findIndex(
        (_, unit) =>
          unit > settings.unit &&
          wordPool(unit).some((word) => !pool.includes(word)),
      );
      changeTopic(stage, later >= 0 ? later : settings.unit + 1);
    } else navigate(stage, mode);
  }
  function selectReadingPart(start: number, text: string) {
    if (stage !== 'words' || mode !== 'read' || awarded.current) return;
    partPractice.current.reset();
    slowAttempt.current.reset();
    setSpeechProgress(0);
    setReadingPart({ start, text });
    setAttemptStatus(
      'Читай с выбранного слога и продолжай дальше. Можно читать без пауз.',
    );
    recognition.current?.setEnabled?.(false);
    recognition.current?.setEnabled?.(true);
  }
  return {
    ready,
    repeatExercise,
    repeatEpoch,
    lessonLength,
    continueLesson,
    speechPreview,
    readingPart,
    selectReadingPart,
    setLessonActive,
    schedule,
    showParts,
    wholeAgain,
    setPartsHelp,
    awardReadingText,
    changeTopic,
    settings,
    stage,
    currentStage,
    stars,
    stop,
    setParent,
    parent,
    update,
    micDevices,
    testMic,
    micTesting,
    micLevel,
    micMessage,
    history,
    exportReport,
    storageWarning,
    target,
    paused,
    rest,
    setPaused,
    setRest,
    speak,
    consent,
    setConsent,
    setLessonMic,
    navigate,
    mode,
    feedback,
    count,
    task,
    speaking,
    done,
    flyCards,
    picture,
    scene,
    setScene,
    index,
    listening,
    mistakes,
    submit,
    input,
    answer,
    typo,
    setTypo,
    setFeedback,
    setAnswer: (value: string) => {
      if (value.trim()) schedule.touch();
      setAnswer(value);
    },
    lessonMic,
    cooldown,
    spectrum,
    loadingSpeech,
    attemptStatus,
    speechProgress,
    flyInputStatus,
    heard,
    hint,
    setHeard,
    next,
    listen,
    supported,
    success,
    setHint,
    setMistakes,
    record,
    setFlyCards,
    flyNext,
    pool,
    setFlyInputStatus,
  };
}
export type LessonModel = ReturnType<typeof useLesson>;
