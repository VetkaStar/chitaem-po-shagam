'use client';
import { useEffect, useRef, useState } from 'react';
import { levels, pictures, breaks, checkTyped } from '@/lib/learning';
import { wordPool, makeDeck, pictureAnswer } from '@/lib/session';
import { SlowReadingAttempt } from '@/lib/slow-reading';
import { findTypo, type TypoHint } from '@/lib/typo';
import { classifyUtterance } from '@/lib/feedback';
import { startLocalSpeech } from '@/lib/local-speech';
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
    [restIndex, setRestIndex] = useState(0),
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
  const resultSink = useRef<(r: any) => void>(() => {}),
    helpLock = useRef(false),
    speechEpoch = useRef(0);
  const input = useRef<HTMLInputElement>(null),
    recognition = useRef<any>(null),
    epoch = useRef(0),
    awarded = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true);
  const slowAttempt = useRef(new SlowReadingAttempt());
  const [speechProgress, setSpeechProgress] = useState(0),
    [attemptStatus, setAttemptStatus] = useState('');
  const activitySink = useRef<(phase: 'sound' | 'pause') => void>(() => {});
  const [typo, setTypo] = useState<TypoHint | null>(null);
  const [deck, setDeck] = useState<string[]>([]),
    [session, setSession] = useState(0),
    [scene, setScene] = useState(false);
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
  useEffect(() => {
    if (ready)
      setDeck((old) => makeDeck(pool, Math.max(24, settings.length), old));
  }, [ready, stage, mode, settings.unit, session]);
  const task =
    stage === 'pictures'
      ? 'Напиши, что на картинке'
      : mode === 'read'
        ? stage === 'letters'
          ? 'Прочитай букву вслух'
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
  function navigate(s: Stage, m: Mode = mode) {
    setSession((n) => n + 1);
    setFlyInputStatus('');
    setLessonMic(false);
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
    try {
      const raw = JSON.parse(
        localStorage.getItem('reading-steps-v3') || 'null',
      );
      if (raw) {
        const s = raw.settings || {};
        setSettings({
          ...defaults,
          ...Object.fromEntries(
            Object.keys(defaults)
              .filter(
                (k) => typeof s[k] === typeof defaults[k as keyof Settings],
              )
              .map((k) => [k, s[k]]),
          ),
          unit:
            Number.isInteger(s.unit) && s.unit >= 0 && s.unit < levels.length
              ? s.unit
              : 0,
          length: [3, 5, 8].includes(s.length) ? s.length : 5,
        });
        if (Number.isInteger(raw.stars) && raw.stars >= 0) setStars(raw.stars);
        if (Array.isArray(raw.history))
          setHistory(
            raw.history
              .filter(
                (e: any) =>
                  e && typeof e.target === 'string' && typeof e.at === 'string',
              )
              .slice(-300),
          );
      }
    } catch {
      setStorageWarning(
        'Сохранение недоступно. Можно заниматься, но результаты останутся только до закрытия страницы.',
      );
    }
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
        JSON.stringify({ settings, stars, history }),
      );
    } catch {
      setStorageWarning('Не удалось сохранить результаты на этом устройстве.');
    }
  }, [settings, stars, history, ready]);
  useEffect(() => {
    function hide() {
      if (document.hidden) {
        stop();
        setPaused(true);
      }
    }
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (!parent && !paused && !rest && !done && mode !== 'read')
      input.current?.focus();
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
    awarded.current = true;
    recognition.current?.setEnabled?.(false);
    setFeedback({ kind: 'success', text: `Верно! ${target}. Получилось!` });
    setHeard('');
    setStars((n) => n + 1);
    record('success', via);
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
  function speak(text: string) {
    setCooldown(true);
    recognition.current?.setEnabled?.(false);
    speechEpoch.current++;
    const token = speechEpoch.current;
    if (!settings.sound) {
      releaseSoon();
      return;
    }
    if (!('speechSynthesis' in window)) {
      releaseSoon();
      return;
    }
    speechSynthesis.cancel();
    const voices = speechSynthesis.getVoices(),
      voice = voices.find((v) => v.lang.toLowerCase().startsWith('ru'));
    if (voices.length && !voice) {
      releaseSoon();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    if (voice) u.voice = voice;
    u.rate = settings.slow ? 0.72 : 0.9;
    setSpeaking(true);
    u.onend = u.onerror = () => {
      if (speechEpoch.current !== token) return;
      setSpeaking(false);
      setCooldown(true);
      releaseSoon(450);
    };
    speechSynthesis.speak(u);
  }
  function wrongResponse(value: string, via: string) {
    if (awarded.current || helpLock.current) return;
    helpLock.current = true;
    recognition.current?.setEnabled?.(false);
    setCooldown(true);
    const attempt = mistakes + 1;
    setMistakes(attempt);
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
  function handleSpeech(r: any) {
    if (
      awarded.current ||
      helpLock.current ||
      speaking ||
      parent ||
      paused ||
      rest ||
      done
    )
      return;
    const text = r.text || '',
      confidence = r.result?.length
        ? Math.min(...r.result.map((x: any) => x.conf))
        : 0;
    const candidates =
      stage === 'words'
        ? wordPool(5)
        : levels.flatMap((l) => l[stage === 'pictures' ? 'words' : stage]);
    const verdict = classifyUtterance(
      text,
      confidence,
      target,
      candidates,
      stage === 'letters' && names[target] ? [names[target]] : [],
    );
    if (verdict.kind === 'rest') {
      stop();
      setPaused(true);
      return;
    }
    if (verdict.kind === 'correct') {
      setAttemptStatus('');
      success('local-speech');
      return;
    }
    if (stage !== 'letters') {
      const part = slowAttempt.current.accept(text, confidence, target);
      setSpeechProgress(part.progress);
      if (part.kind === 'complete') {
        setAttemptStatus('');
        success('local-speech-parts');
        return;
      }
      if (part.kind === 'pending') {
        setAttemptStatus('Начало услышано. Продолжай, я жду.');
        return;
      }
    }
    if (verdict.kind === 'ignore') {
      setAttemptStatus(
        'Звук услышан. Попробуй прочитать слово на карточке — можно по частям.',
      );
      return;
    }
    if (verdict.kind === 'wrong') {
      setAttemptStatus('');
      wrongResponse(verdict.heard!, 'local-speech');
      return;
    }
    setHeard('');
    setFeedback({
      kind: 'uncertain',
      text: 'Не расслышал. Скажи ещё раз — я слушаю.',
    });
  }
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
    if (phase === 'sound') setAttemptStatus('Слышу звук. Читай в своём темпе.');
    else
      setAttemptStatus(
        slowAttempt.current.progress
          ? 'Начало услышано. Продолжай, я жду.'
          : 'Попытка услышана, но слово пока не распознано. Попробуй ещё раз или послушай образец.',
      );
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
        ...wordPool(5),
        ...levels.flatMap((l) => [
          ...(stage === 'letters' ? l.letters.map((x) => names[x] || x) : []),
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
      onPartial: () => {
        if (epoch.current === token) activitySink.current('sound');
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
  function catchCard() {
    if (!answer.trim() || paused || rest || done) return;
    const card = flyCards.find(
      (c) =>
        !c.caught && !caughtIds.current.has(c.id) && checkTyped(answer, c.text),
    );
    if (!card) {
      setFlyInputStatus('Найди такой же на дорожке. Можно исправить ответ.');
      return;
    }
    caughtIds.current.add(card.id);
    setFlyCards((cards) =>
      cards.map((c) => (c.id === card.id ? { ...c, caught: true } : c)),
    );
    setAnswer('');
    setFlyInputStatus(`Поймано: ${card.text}!`);
    setStars((n) => n + 1);
    setHistory((h) =>
      [
        ...h,
        {
          at: new Date().toISOString(),
          target: card.text,
          stage,
          mode,
          result: 'success',
          via: 'catch',
        },
      ].slice(-300),
    );
    const completed = count + 1;
    setCount(completed);
    if (completed >= settings.length) setDone(true);
    else if (completed % 3 === 0) {
      setRestIndex((i) => (i + 1) % breaks.length);
      setRest(true);
    }
  }
  function showTypo() {
    const correction = findTypo(answer, target, picture ? wordPool(5) : []);
    if (!correction) return false;
    setTypo(correction);
    setHint(false);
    setHeard('');
    setFeedback({ kind: 'neutral', text: correction.message });
    record('spelling-help', 'typed');
    if (settings.sound && settings.autoSpeech) speak(correction.message);
    return true;
  }
  function submit() {
    setTypo(null);
    if (mode === 'fly') {
      catchCard();
      return;
    }
    if (awarded.current) return;
    if (!answer.trim()) return;
    if (!/[а-яё]/i.test(answer)) {
      setFeedback({
        kind: 'uncertain',
        text: 'Переключи клавиатуру на русский язык.',
      });
      return;
    }
    if (picture) {
      const verdict = pictureAnswer(answer, target);
      if (verdict.kind === 'exact') success('typed');
      else if (verdict.kind === 'part') {
        setHint(false);
        setHeard('');
        setFeedback({ kind: 'neutral', text: verdict.message });
        record('observation', 'typed');
        if (settings.sound && settings.autoSpeech) speak(verdict.message);
      } else if (verdict.kind === 'related' || verdict.kind === 'similar') {
        setScene(true);
        setHint(true);
        setFeedback({ kind: 'neutral', text: verdict.message });
        record('related', 'typed');
        if (settings.sound && settings.autoSpeech) speak(verdict.message);
      } else {
        if (showTypo()) return;
        setScene(true);
        setHint(true);
        setFeedback({
          kind: 'uncertain',
          text: verdict.kind === 'other' ? verdict.message : 'Напиши слово.',
        });
        record('help', 'typed');
      }
      return;
    }
    if (checkTyped(answer, target)) success('typed');
    else if (!showTypo()) wrongResponse('', 'typed');
  }
  function next(skip = false) {
    if (!skip && !awarded.current) return;
    if (skip && !awarded.current) record('skipped', 'manual');
    const nextCount = count + 1;
    resetCard();
    setIndex((i) => i + 1);
    setCount(nextCount);
    if (nextCount >= settings.length) setDone(true);
    else if (nextCount % 3 === 0) {
      setRest(true);
      setRestIndex((i) => (i + 1) % breaks.length);
    }
  }
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === 'micConsent' && !value) {
      setLessonMic(false);
      stop();
    }
    if (key === 'unit' || key === 'length') {
      setSession((n) => n + 1);
      resetCard();
      setIndex(0);
      setCount(0);
      setDone(false);
      setRest(false);
    }
    setSettings((s) => ({ ...s, [key]: value }));
  }
  function exportReport() {
    const text = [
      'Читаем по шагам — результаты на этом устройстве',
      'Дата;Материал;Раздел;Режим;Результат;Проверка',
      ...history.map((h) =>
        [h.at, h.target, h.stage, h.mode, h.result, h.via].join(';'),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reading-progress.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  useEffect(() => {
    const context = (document as any).modelContext;
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

  return {
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
    setAnswer,
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
