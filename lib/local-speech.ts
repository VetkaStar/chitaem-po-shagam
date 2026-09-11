/* Local speech engine: microphone samples stay on this device. */
type VoskResult = { text?: string; result?: { conf: number; word: string }[] };
type RecognizerMessage = { result?: VoskResult & { partial?: string } };
type Recognizer = {
  setWords: (words: boolean) => void;
  acceptWaveform: (buffer: AudioBuffer) => void;
  on: (
    event: 'result' | 'partialresult' | 'error',
    handler: (message: RecognizerMessage) => void,
  ) => void;
  remove: () => void;
};
type Model = {
  KaldiRecognizer: new (rate: number, grammar?: string) => Recognizer;
  on: (
    event: 'load' | 'error',
    handler: (message: { result?: boolean }) => void,
  ) => void;
  terminate: () => void;
};
/** The global that speech/vosk.js defines once it has loaded. */
const vosk = () =>
  (
    window as Window & {
      Vosk?: { Model: new (url: string, logLevel: number) => Model };
    }
  ).Vosk;
let cachedModel: Promise<Model> | undefined;
let scriptPromise: Promise<void> | undefined;
function loadScript() {
  if (vosk()) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('speech/vosk.js', document.baseURI).href;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = undefined;
        s.remove();
        reject(
          new Error('Не удалось загрузить движок. Проверь интернет и повтори.'),
        );
      };
      document.head.appendChild(s);
    });
  return scriptPromise;
}
function loadLocalModel(progress: (text: string) => void = () => {}) {
  if (cachedModel) return cachedModel;
  cachedModel = (async () => {
    await loadScript();
    const response = await fetch(
      new URL('speech/model.json', document.baseURI).href,
    );
    if (!response.ok) throw Error('Не удалось загрузить описание модели.');
    const manifest = (await response.json()) as {
      bytes: number;
      parts: { file: string; size: number; sha256: string }[];
    };
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (const part of manifest.parts) {
      const r = await fetch(
        new URL('speech/' + part.file, document.baseURI).href,
      );
      if (!r.ok)
        throw Error(
          'Не удалось скачать русскую модель. Проверь интернет и повтори.',
        );
      const data = new Uint8Array(await r.arrayBuffer());
      if (data.length !== part.size)
        throw Error('Модель загрузилась не полностью. Попробуй ещё раз.');
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', data)),
      )
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
      if (hash !== part.sha256)
        throw Error('Ошибка проверки модели. Попробуй ещё раз.');
      chunks.push(data);
      bytes += data.length;
      progress(
        'Загружаю русскую модель: ' +
          Math.round((bytes / manifest.bytes) * 100) +
          '%',
      );
    }
    progress('Подготавливаю распознавание…');
    const url = URL.createObjectURL(
      new Blob(chunks as BlobPart[], { type: 'application/gzip' }),
    );
    const Vosk = vosk()!;
    const model = new Vosk.Model(url, -1);
    try {
      return await new Promise<Model>((resolve, reject) => {
        const timeout = setTimeout(() => {
          model.terminate();
          reject(
            Error(
              'Модель не успела запуститься. Закрой лишние вкладки и повтори.',
            ),
          );
        }, 90000);
        model.on('load', (m) => {
          clearTimeout(timeout);
          if (m.result) resolve(model);
          else {
            model.terminate();
            reject(Error('Не удалось запустить русскую модель.'));
          }
        });
        model.on('error', () => {
          clearTimeout(timeout);
          model.terminate();
          reject(Error('Ошибка запуска распознавания. Попробуй ещё раз.'));
        });
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  })().catch((e) => {
    cachedModel = undefined;
    throw e;
  });
  return cachedModel;
}
export type SpeechCallbacks = {
  deviceId?: string;
  vocabulary?: string[];
  onLevel: (level: number) => void;
  onSpectrum?: (levels: number[]) => void;
  onStatus: (text: string) => void;
  onReady: () => void;
  onActivity?: (phase: 'sound' | 'pause') => void;
  onPartial: (text: string) => void;
  onResult: (result: VoskResult) => void;
  onError: (message: string) => void;
};
export function startLocalSpeech(callbacks: SpeechCallbacks) {
  let closed = false,
    enabled = true,
    stream: MediaStream | undefined,
    context: AudioContext | undefined,
    source: MediaStreamAudioSourceNode | undefined,
    node: ScriptProcessorNode | undefined,
    recognizer: Recognizer | undefined,
    model: Model | undefined,
    frame = 0,
    generation = 0,
    soundSince = 0,
    lastSound = 0,
    attemptActive = false,
    announced = false;
  const removeRecognizer = () => {
    generation++;
    try {
      recognizer?.remove();
    } catch {}
    recognizer = undefined;
  };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(frame);
    if (node) {
      node.onaudioprocess = null;
      node.disconnect();
    }
    source?.disconnect();
    stream?.getTracks().forEach((t) => t.stop());
    removeRecognizer();
    if (context && context.state !== 'closed') void context.close();
    callbacks.onLevel(0);
    callbacks.onSpectrum?.(Array(12).fill(0));
  };
  const error = (message: string) => {
    if (closed) return;
    cleanup();
    callbacks.onError(message);
  };
  const createRecognizer = () => {
    removeRecognizer();
    if (!enabled || !model || !context || closed) return;
    const current = generation;
    recognizer = new model.KaldiRecognizer(
      context.sampleRate,
      callbacks.vocabulary
        ? JSON.stringify([
            ...new Set(callbacks.vocabulary.map((w) => w.toLowerCase())),
            '[unk]',
          ])
        : undefined,
    );
    recognizer.setWords(true);
    recognizer.on('result', (m) => {
      const result = m.result;
      if (
        !closed &&
        enabled &&
        current === generation &&
        result &&
        result.text?.trim()
      )
        callbacks.onResult(result);
    });
    recognizer.on('partialresult', (m) => {
      const partial = m.result?.partial;
      if (
        !closed &&
        enabled &&
        current === generation &&
        partial &&
        partial.trim()
      )
        callbacks.onPartial(partial);
    });
    recognizer.on('error', () => {
      if (current === generation)
        error('Не получилось обработать звук. Включи микрофон ещё раз.');
    });
  };
  const setEnabled = (value: boolean) => {
    if (closed || enabled === value) return;
    enabled = value;
    soundSince = 0;
    lastSound = 0;
    attemptActive = false;
    announced = false;
    createRecognizer();
  };
  void (async () => {
    try {
      context = new AudioContext();
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: callbacks.deviceId
            ? { exact: callbacks.deviceId }
            : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });
      if (closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Float32Array(analyser.fftSize),
        frequency = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const meter = () => {
        if (closed) return;
        const now = performance.now();
        if (now - last > 80) {
          analyser.getFloatTimeDomainData(samples);
          analyser.getByteFrequencyData(frequency);
          let sum = 0;
          for (const sample of samples) sum += sample * sample;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 8);
          callbacks.onLevel(level);
          if (enabled && recognizer) {
            if (level > 0.06) {
              if (!soundSince) soundSince = now;
              lastSound = now;
              if (now - soundSince > 220) {
                attemptActive = true;
                if (!announced) {
                  announced = true;
                  callbacks.onActivity?.('sound');
                }
              }
            } else {
              if (now - lastSound > 250) soundSince = 0;
              if (attemptActive && now - lastSound > 2500) {
                attemptActive = false;
                announced = false;
                callbacks.onActivity?.('pause');
              }
            }
          }
          callbacks.onSpectrum?.(
            Array.from({ length: 12 }, (_, i) => {
              const start = Math.floor((i * frequency.length) / 24),
                end = Math.max(
                  start + 1,
                  Math.floor(((i + 1) * frequency.length) / 24),
                );
              let total = 0;
              for (let j = start; j < end; j++) total += frequency[j];
              return total / (end - start) / 255;
            }),
          );
          last = now;
        }
        frame = requestAnimationFrame(meter);
      };
      meter();
      callbacks.onStatus('Готовлю микрофон. Пока говорить не нужно.');
      model = await loadLocalModel((t) => {
        if (!closed) callbacks.onStatus(t);
      });
      if (closed) return;
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') {
        error('Браузер приостановил звук. Включи микрофон ещё раз.');
        return;
      }
      createRecognizer();
      node = context.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => {
        if (!closed && enabled && recognizer) {
          try {
            recognizer.acceptWaveform(e.inputBuffer);
          } catch {
            error('Не получилось прочитать сигнал микрофона.');
          }
        }
      };
      source.connect(node);
      node.connect(context.destination);
      callbacks.onReady();
    } catch (e) {
      if (closed) return;
      const name = (e as Error).name;
      error(
        name === 'NotAllowedError'
          ? 'Разреши микрофон для этого сайта.'
          : name === 'NotFoundError'
            ? 'Микрофон не найден. Выбери его в настройках.'
            : name === 'NotReadableError'
              ? 'Микрофон занят другим приложением.'
              : name === 'OverconstrainedError'
                ? 'Выбранный микрофон отключён. Выбери другой.'
                : (e as Error).message || 'Не удалось включить микрофон.',
      );
    }
  })();
  return { abort: cleanup, setEnabled };
}
