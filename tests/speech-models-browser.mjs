/** Opt-in real ONNX/WASM smoke test; public adult audio, never a child-speech quality benchmark. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';
const { chromium } = await import(
  pathToFileURL(
    path.join(
      process.env.PLAYWRIGHT_PACKAGE ||
        'C:/Users/Vetka/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
      'index.mjs',
    ),
  )
);
const root = path.resolve(import.meta.dirname, '..');
const server = await preview({
  configFile: path.join(root, 'vite.pages.config.ts'),
  preview: { host: '127.0.0.1', port: 3038, strictPort: true },
  logLevel: 'error',
});
const browser = await chromium.launchPersistentContext(
  path.join(root, '.local/speech-tests/browser-profile'),
  { headless: true, channel: 'msedge' },
);
const page = await browser.newPage();
page.on('console', (msg) => {
  fs.appendFileSync(
    path.join(root, '.local/speech-tests/console.log'),
    msg.type() + ': ' + msg.text() + '\n',
  );
  if (msg.type() === 'error') console.log('console:', msg.text().slice(0, 400));
});
page.on('response', (response) => {
  if (response.status() >= 400)
    console.log('HTTP', response.status(), response.url());
});
page.on('pageerror', (error) => console.log('pageerror:', error.message));
const report = [];
try {
  await page.goto('http://127.0.0.1:3038');
  const workerFile = fs
    .readdirSync(path.join(root, 'dist-pages/assets'))
    .find((name) => name.startsWith('inference.worker-'));
  const wav = [
    ...fs.readFileSync(path.join(root, '.local/speech-tests/sample.wav')),
  ];
  const models = process.argv.slice(2);
  for (const model of models.length
    ? models
    : ['zipformer-int8', 'gigaam-ctc-int8', 'whisper-base-int8']) {
    console.log('START', model);
    const result = await page.evaluate(
      async ({ model, workerFile, wav }) => {
        const worker = new Worker('/assets/' + workerFile, { type: 'module' });
        const audio = new AudioContext();
        const decoded = await audio.decodeAudioData(
          Uint8Array.from(wav).buffer,
        );
        const samples = decoded.getChannelData(0);
        const output = [];
        const scores = [];
        let serial = 0;
        const request = (kind, pcm) =>
          new Promise((resolve, reject) => {
            const id = ++serial;
            const timer = setTimeout(
              () => reject(new Error('timeout')),
              600000,
            );
            worker.onerror = (error) => {
              clearTimeout(timer);
              reject(new Error(error.message));
            };
            worker.onmessage = ({ data }) => {
              if (data.id !== id) return;
              if (data.status) console.log(model, data.status);
              if (data.result?.confidenceScore !== undefined) scores.push(data.result.confidenceScore);
              if (data.result?.final && data.result.text)
                output.push(data.result.text);
              if (data.error) {
                clearTimeout(timer);
                reject(new Error(data.error));
              }
              if (data.done) {
                clearTimeout(timer);
                resolve();
              }
            };
            worker.postMessage({
              id,
              kind,
              model,
              samples: pcm,
              rate: decoded.sampleRate,
            });
          });
        const start = performance.now();
        try {
          await request('load');
          const loadedMs = performance.now() - start;
          await request('reset');
          if (model.startsWith('zipformer')) {
            for (let i = 0; i < samples.length; i += 4096)
              await request('audio', samples.slice(i, i + 4096));
            await request('finish');
          } else await request('audio', samples);
          return {
            model,
            loadedMs,
            totalMs: performance.now() - start,
            scores,
            text: output.join(' '),
          };
        } catch (error) {
          return { model, error: String(error), output };
        } finally {
          worker.terminate();
          await audio.close();
        }
      },
      { model, workerFile, wav },
    );
    console.log(JSON.stringify(result));
    if (model.startsWith('gigaam-ctc') && !result.error) assert(result.scores?.length && result.scores.every(s=>Number.isFinite(s)&&s>=0&&s<=1), 'real CTC score required');
    report.push(result);
  }
  fs.writeFileSync(
    path.join(root, '.local/speech-tests/browser-report.json'),
    JSON.stringify(report, null, 2),
  );
  assert(
    report.every((result) => !result.error && result.text),
    'Every selected model must load and transcribe actual audio.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
