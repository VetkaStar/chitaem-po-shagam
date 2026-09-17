'use client';
import { useEffect, useRef, useState } from 'react';
import { startLocalSpeech } from '../../lib/local-speech';
import { parseSpeechModel, speechModels } from '../../lib/speech/models';
import type { Settings } from './config';

export default function SpeechSettings({
  settings,
  update,
  stop,
  open,
  micTesting,
}: {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  stop: () => void;
  open: boolean;
  micTesting: boolean;
}) {
  const engine = useRef<ReturnType<typeof startLocalSpeech> | null>(null);
  const epoch = useRef(0);
  const [phase, setPhase] = useState<'off' | 'loading' | 'ready' | 'finishing'>(
    'off',
  );
  const [status, setStatus] = useState('');
  const [level, setLevel] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [actual, setActual] = useState('');
  const selected =
    speechModels.find((m) => m.id === settings.speechModel) ?? speechModels[0];
  function cancel() {
    epoch.current++;
    engine.current?.abort();
    engine.current = null;
    setPhase('off');
    setLevel(0);
  }
  useEffect(() => {
    if (micTesting) cancel();
  }, [micTesting]);
  useEffect(() => {
    cancel();
    setLines([]);
    setStatus('');
    setActual('');
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      cancel();
    };
  }, [open, settings.speechModel, settings.micProcessing, settings.micDevice]);
  function begin() {
    cancel();
    stop();
    setLines([]);
    setActual('');
    setPhase('loading');
    const token = epoch.current;
    const started = performance.now();
    setStatus('Подготовка модели и микрофона…');
    engine.current = startLocalSpeech({
      deviceId: settings.micDevice,
      speechModel: settings.speechModel,
      micProcessing: settings.micProcessing,
      onLevel: (value) => {
        if (token === epoch.current) setLevel(value);
      },
      onStatus: (message) => {
        if (token === epoch.current) setStatus(message);
      },
      onReady: () => {
        if (token !== epoch.current) return;
        setPhase('ready');
        setStatus(
          `Готово за ${((performance.now() - started) / 1000).toFixed(1)} с. Произнесите слог или слово и сделайте паузу.`,
        );
      },
      onCaptureSettings: (capture) => {
        if (token !== epoch.current) return;
        const show = (value: boolean | undefined) =>
          value === undefined ? 'не сообщает' : value ? 'вкл.' : 'выкл.';
        setActual(
          `Браузер: шумоподавление — ${show(capture.noiseSuppression)}, автогромкость — ${show(capture.autoGainControl)}, эхо — ${show(capture.echoCancellation)}.`,
        );
      },
      onPartial: () => {},
      onResult: (result) => {
        if (token !== epoch.current || !result.text?.trim()) return;
        const timing =
          result.elapsedMs === undefined
            ? ''
            : ` · обработка ${(result.elapsedMs / 1000).toFixed(2)} с`;
        setLines((previous) => [
          ...previous.slice(-19),
          result.text!.trim() + timing,
        ]);
      },
      onError: (message) => {
        if (token === epoch.current) {
          setStatus(message);
          setPhase('off');
        }
      },
    });
  }
  async function finish() {
    const token = epoch.current;
    setPhase('finishing');
    setStatus('Завершаю распознавание…');
    try {
      await engine.current?.finish();
      if (token === epoch.current) {
        setPhase('off');
        setStatus('Проверка завершена.');
      }
    } catch {
      if (token === epoch.current) {
        cancel();
        setStatus('Не удалось завершить проверку. Попробуйте ещё раз.');
      }
    }
  }
  return (
    <section
      className="mic-settings speech-settings"
      aria-label="Распознавание речи"
    >
      <h3>Распознавание речи</h3>
      <label htmlFor="speech-model">Модель распознавания</label>
      <select
        id="speech-model"
        value={selected.id}
        onChange={(event) => {
          cancel();
          stop();
          update('speechModel', parseSpeechModel(event.target.value));
        }}
      >
        {speechModels.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label} · ≈{model.mb} МБ
          </option>
        ))}
      </select>
      <p>
        При первом включении скачивается только выбранная модель. Голос
        обрабатывается на устройстве. Повторная загрузка не нужна, пока браузер
        сохраняет кэш.
      </p>
      {selected.id !== 'vosk' && (
        <p className="warning">
          Экспериментальная модель. Качество детской речи пока проверяется. В
          занятиях принимается полное совпадение окончательно распознанного
          ответа. Читай слово или выделенную строку целиком. Оценку произношения
          модель не даёт; можно проверить вместе со взрослым.
        </p>
      )}
      <label className="speech-processing">
        <input
          type="checkbox"
          checked={settings.micProcessing}
          onChange={(event) => {
            cancel();
            stop();
            update('micProcessing', event.target.checked);
          }}
        />{' '}
        Обработка микрофона
      </label>
      <p>
        Шумоподавление, автоматическая громкость и подавление эха. Выключите для
        сравнения с необработанным звуком.
      </p>
      <div className="speech-test-actions">
        {phase === 'off' ? (
          <button onClick={begin}>Проверить распознавание</button>
        ) : (
          <>
            {phase === 'ready' && (
              <button onClick={() => void finish()}>Завершить запись</button>
            )}
            <button
              onClick={() => {
                cancel();
                setStatus('Проверка остановлена.');
              }}
            >
              Отменить проверку
            </button>
          </>
        )}
      </div>
      <meter
        min={0}
        max={1}
        value={level}
        aria-label="Громкость при проверке распознавания"
      />
      <p role="status">{status}</p>
      {actual && <small>{actual}</small>}
      {!!lines.length && (
        <div className="speech-test-results">
          <b>Распознано — только для взрослого</b>
          <ol>
            {lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>
      )}
      <small>
        Проверка не начисляет звёзды. Запись и расшифровка не сохраняются; текст
        очищается при закрытии настроек.
      </small>
    </section>
  );
}
