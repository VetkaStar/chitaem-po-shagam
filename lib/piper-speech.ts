type Options = {
  slow: boolean;
  onStatus?: (text: string) => void;
  onEnd: () => void;
  onError: (error: Error) => void;
};
let cancelCurrent: (() => void) | undefined;
export function stopPiperSpeech() {
  cancelCurrent?.();
  cancelCurrent = undefined;
}
/** Text and generated audio stay on the device. This facade keeps worker code lazy. */
export function speakPiper(text: string, options: Options) {
  stopPiperSpeech();
  let stopped = false,
    url: string | undefined,
    cancelGeneration: (() => void) | undefined;
  const audio = new Audio();
  audio.preservesPitch = true;
  audio.playbackRate = options.slow ? 0.8 : 1;
  const cancel = () => {
    if (stopped) return;
    stopped = true;
    cancelGeneration?.();
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (url) URL.revokeObjectURL(url);
    if (cancelCurrent === cancel) cancelCurrent = undefined;
  };
  cancelCurrent = cancel;
  // Prime the same media element during the explicit click, before model download.
  audio.src =
    'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';
  void audio.play().catch(() => {});
  const fail = (error: unknown) => {
    if (stopped) return;
    cancel();
    options.onError(error instanceof Error ? error : new Error(String(error)));
  };
  options.onStatus?.('Подготавливаю голос Piper…');
  void import('./piper-client')
    .then(async (client) => {
      if (stopped) return;
      cancelGeneration = client.cancelPiperGeneration;
      const wav = await client.generatePiper(text, (value) => {
        if (!stopped) options.onStatus?.(value);
      });
      if (stopped) return;
      url = URL.createObjectURL(wav);
      audio.src = url;
      audio.onended = () => {
        if (!stopped) {
          cancel();
          options.onEnd();
        }
      };
      audio.onerror = () =>
        fail(new Error('Не удалось воспроизвести озвучку.'));
      options.onStatus?.('Воспроизведение…');
      await audio.play();
    })
    .catch(fail);
  return cancel;
}
