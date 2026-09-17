import { TtsSession } from '@mintplex-labs/piper-tts-web';

let session: TtsSession | undefined;
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<{ id: number; text: string }>) => {
  queue = queue.then(async () => {
    const { id, text } = data;
    try {
      session ??= await TtsSession.create({
        voiceId: 'ru_RU-irina-medium',
        wasmPaths: { ...TtsSession.WASM_LOCATIONS, onnxWasm: '' },
        progress: (p) =>
          self.postMessage({
            id,
            status: p.url.startsWith('tts:')
              ? 'Готовлю озвучку…'
              : `Загружаю голос: ${Math.round(p.loaded / 1e6)}${p.total ? ' / ' + Math.round(p.total / 1e6) : ''} МБ`,
          }),
      });
      self.postMessage({ id, status: 'Готовлю озвучку…' });
      const wav = await session.predict(text);
      self.postMessage({ id, wav });
    } catch (error) {
      session = undefined;
      self.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
