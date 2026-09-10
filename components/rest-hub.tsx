'use client';
import { useEffect, useRef, useState } from 'react';
import { breaks } from '@/lib/learning';
import MatchPairs from './match-pairs';
import type { VisionMode } from '@/lib/vision';
import ColorBubbles from '@/components/color-bubbles';

type Game = 'menu' | 'move' | 'bubbles' | 'pairs' | 'music';
const notes = [261.63, 293.66, 329.63, 392, 440];
const song = [0, 0, 2, 2, 3, 3, 2, 1, 1, 0, 1, 2, 1, 0];
export default function RestHub({
  sound,
  motion,
  autoSpeech,
  vision = 'off',
  onSpeak,
  onReturn,
  onEngage,
}: {
  sound: boolean;
  motion: boolean;
  autoSpeech: boolean;
  vision?: VisionMode;
  onSpeak: (s: string) => void;
  onReturn: () => void;
  onEngage: () => void;
}) {
  const [game, setGame] = useState<Game>('menu'),
    [move, setMove] = useState(0),
    [active, setActive] = useState(-1),
    [playing, setPlaying] = useState(false);
  const audio = useRef<AudioContext | null>(null),
    timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  function silence() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (audio.current) {
      void audio.current.close();
      audio.current = null;
    }
    setPlaying(false);
    setActive(-1);
    window.speechSynthesis?.cancel();
  }
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      void audio.current?.close();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  function choose(g: Game) {
    if (g !== 'menu') onEngage();
    silence();
    setGame(g);
  }
  function tone(n: number, duration = 0.4) {
    setActive(n);
    if (sound) {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      void ctx.resume();
      const o = ctx.createOscillator(),
        gain = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = notes[n];
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      o.connect(gain);
      gain.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + duration + 0.03);
    }
    timers.current.push(setTimeout(() => setActive(-1), duration * 1000));
  }
  function melody() {
    if (playing) {
      silence();
      return;
    }
    silence();
    setPlaying(true);
    song.forEach((n, i) =>
      timers.current.push(setTimeout(() => tone(n, 0.43), i * 600)),
    );
    timers.current.push(
      setTimeout(() => {
        setPlaying(false);
        setActive(-1);
      }, song.length * 600),
    );
  }
  return (
    <div className="rest-hub">
      <div className="rest-activity">
        {game === 'menu' ? (
          <>
            <p>Выбери, как отдохнуть</p>
            <div className="rest-menu">
              <button onClick={() => choose('move')}>
                <span>🙌</span>
                <b>Размяться</b>
                <small>Двигаемся вместе</small>
              </button>
              <button onClick={() => choose('bubbles')}>
                <span>🫧</span>
                <b>Пузырьки</b>
                <small>Найди нужный цвет</small>
              </button>
              <button onClick={() => choose('pairs')}>
                <span>🍓</span>
                <b>Найди пару</b>
                <small>Открой две картинки</small>
              </button>
              <button onClick={() => choose('music')}>
                <span>🎵</span>
                <b>Музыкальная полянка</b>
                <small>Играй или слушай мелодию</small>
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="text-button" onClick={() => choose('menu')}>
              ← Другой отдых
            </button>
            {game === 'move' && (
              <div className="movement">
                <span className="rest-emoji">{breaks[move].icon}</span>
                <h3>{breaks[move].title}</h3>
                <p>{breaks[move].text}</p>
                <button onClick={() => onSpeak(breaks[move].text)}>
                  🔊 Послушать
                </button>
                <button
                  onClick={() => {
                    window.speechSynthesis?.cancel();
                    setMove((i) => (i + 1) % breaks.length);
                  }}
                >
                  Другое движение →
                </button>
              </div>
            )}
            {game === 'bubbles' && (
              <ColorBubbles
                sound={sound}
                motion={motion}
                autoSpeech={autoSpeech}
                vision={vision}
                onSpeak={onSpeak}
                onTone={() => tone(2, 0.14)}
              />
            )}
            {game === 'pairs' && <MatchPairs />}
            {game === 'music' && (
              <>
                <span className="music-tree" aria-hidden>
                  🌿
                </span>
                <p>Нажимай на цветы — сочини свою мелодию</p>
                <div className="music-keys">
                  {['🌼', '🌷', '🌸', '🌻', '🌺'].map((s, i) => (
                    <button
                      key={s}
                      className={active === i ? 'note-on' : ''}
                      aria-label={`Нота ${i + 1}`}
                      disabled={playing}
                      onClick={() => tone(i)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <button onClick={melody}>
                  {playing ? '■ Остановить мелодию' : '▶ Послушать мелодию'}
                </button>
                <p className="music-verse">
                  Руки к солнцу подними,
                  <br />
                  Облачку рукой махни.
                  <br />
                  Тихо плечи опусти,
                  <br />
                  Улыбнись и отдохни.
                </p>
                <button
                  onClick={() => {
                    silence();
                    onSpeak(
                      'Руки к солнцу подними. Облачку рукой махни. Тихо плечи опусти. Улыбнись и отдохни.',
                    );
                  }}
                >
                  🔊 Стишок с движениями
                </button>
                {!sound && (
                  <small>
                    Звук выключен в настройках взрослого. Цветы всё равно
                    загораются.
                  </small>
                )}
              </>
            )}
          </>
        )}
      </div>
      <button
        className="primary return-lesson"
        onClick={() => {
          silence();
          onReturn();
        }}
      >
        Вернуться к чтению →
      </button>
    </div>
  );
}
