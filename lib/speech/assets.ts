/** Only model files are cached. Microphone audio never reaches fetch or persistent storage. */
export async function modelFile(
  url: string,
  status: (message: string) => void,
): Promise<Uint8Array> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open('reading-asr-models-v1');
  } catch {
    /* private mode */
  }
  const saved = await cache?.match(url);
  if (saved) return new Uint8Array(await saved.arrayBuffer());
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Не удалось загрузить файл модели (${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const total = Number(response.headers.get('content-length'));
  const chunks: Uint8Array[] = [];
  let size = 0,
    last = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (Date.now() - last > 300) {
      status(
        `Загрузка модели: ${Math.round(size / 1e6)}${total ? ' / ' + Math.round(total / 1e6) : ''} МБ`,
      );
      last = Date.now();
    }
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    await cache?.put(
      url,
      new Response(result, {
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );
  } catch {
    status('Модель загружена. Браузер не сохранил её в кэше.');
  }
  return result;
}
