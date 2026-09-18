import { parseNarrator, piperVoices } from '../../lib/narrator-models';
import { useEffect, useRef, useState } from 'react';
import { speakPiper } from '../../lib/piper-speech';
import type { Settings } from './config';

export default function NarratorSettings({
  settings,
  update,
  stop,
}: {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  stop: () => void;
}) {
  const [text, setText] = useState(
    'Маша нашла шишку. Жук жужжит. Щенок ищет мяч. Ма. Ша. Жу. Ща.',
  );
  const [status, setStatus] = useState('');
  const [playing, setPlaying] = useState(false);
  const cancelRef = useRef<(() => void) | undefined>(undefined);
  const epoch = useRef(0);
  const cancel = () => {
    epoch.current++;
    cancelRef.current?.();
    cancelRef.current = undefined;
    setPlaying(false);
  };
  useEffect(() => {
    cancel();
    setStatus('');
    const hidden = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancel();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [settings.narrator, settings.voice, settings.slow, settings.narrationRate, settings.sound]);
  function preview() {
    cancel();
    stop();
    if (!text.trim() || !settings.sound) return;
    setPlaying(true);
    const token = epoch.current;
    const end = (message: string) => {
      if (token === epoch.current) {
        setStatus(message);
        setPlaying(false);
      }
    };
    {
      cancelRef.current = speakPiper(text.trim(), {
        slow: settings.slow,
        rate: settings.narrationRate,
          narrator: settings.narrator,
        onStatus: (value) => {
          if (token === epoch.current) setStatus(value);
        },
        onEnd: () => end('Готово.'),
        onError: (error) => end(error.message),
      });
    }
  }
  return (
    <section
      className="mic-settings narrator-settings"
      aria-label="Автоматическая озвучка"
    >
      <h3>Автоматическая озвучка</h3>
      <label htmlFor="narrator-engine">Голос озвучки</label>
      <select
        id="narrator-engine"
        value={settings.narrator}
        onChange={(event) => {
          cancel();
          stop();
          update(
            'narrator',
            parseNarrator(event.target.value),
          );
        }}
      >
        {piperVoices.map(v => <option key={v.id} value={v.id}>Piper — {v.label}, на устройстве</option>)}
      </select>
      {settings.narrator?.startsWith('piper-') && (
        <p>
          При первом прослушивании загрузится голос: около 63 МБ плюс файлы
          движка. Текст озвучивается на устройстве, без API. Ударения и короткие
          слоги стоит проверить перед занятием.
        </p>
      )}
      <label htmlFor="narration-rate">Скорость озвучки</label>
      <select id="narration-rate" value={settings.narrationRate} onChange={event => {
        cancel(); stop(); update('narrationRate', Number(event.target.value));
      }}>
        {[0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5].map(rate =>
          <option key={rate} value={rate}>{rate.toFixed(1)}×{rate === 1 ? ' — обычная' : ''}</option>)}
      </select>
      <label htmlFor="narrator-sample">Текст для проверки</label>
      <textarea
        id="narrator-sample"
        rows={3}
        maxLength={500}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {playing ? (
        <button
          onClick={() => {
            cancel();
            setStatus('Остановлено.');
          }}
        >
          Остановить озвучку
        </button>
      ) : (
        <button disabled={!settings.sound || !text.trim()} onClick={preview}>
          Послушать голос
        </button>
      )}
      {!settings.sound && (
        <p>Для проверки включите «Разрешить прослушивание и музыку».</p>
      )}
      <p role="status">{status}</p>
    </section>
  );
}
