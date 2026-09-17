/** Settings UI and lifetime checks; model numerical execution is tested separately. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
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
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false },
  logLevel: 'error',
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});
fs.mkdirSync(path.join(root, '.local/speech-tests'), { recursive: true });
try {
  for (const width of [390, 820, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      permissions: ['microphone'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem('reading-profile-v1')) {
        localStorage.setItem(
          'reading-profile-v1',
          JSON.stringify({ name: 'Тест', age: '8', start: 'words' }),
        );
        localStorage.setItem(
          'reading-steps-v3',
          JSON.stringify({
            settings: {
              styleChosen: true,
              sound: false,
              layout: 'order',
              unit: 12,
            },
            stars: 37,
            history: [],
          }),
        );
      }
      window.testStreams = [];
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await getUserMedia(constraints);
        window.testStreams.push(stream);
        return stream;
      };
      window.Worker = class {
        onmessage;
        onerror;
        postMessage(request) {
          setTimeout(
            () => this.onmessage?.({ data: { id: request.id, done: true } }),
            10,
          );
        }
        terminate() {}
      };
    });
    await page.goto(base);
    const open = async () => {
      const menu = page.getByRole('button', {
        name: 'Открыть меню',
        exact: true,
      });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole('button', { name: 'Для взрослого', exact: true })
        .first()
        .click();
      await page.locator('#speech-model').waitFor();
    };
    await open();
    const select = page.locator('#speech-model');
    assert.equal(await select.locator('option').count(), 7);
    for (const id of [
      'gigaam-ctc-int8',
      'gigaam-ctc-fp32',
      'gigaam-rnnt-int8',
      'zipformer-int8',
      'zipformer-fp32',
      'whisper-base-int8',
      'vosk',
    ]) {
      await select.selectOption(id);
      assert.equal(await select.inputValue(), id);
    }
    await select.selectOption('gigaam-ctc-int8');
    await page.getByRole('checkbox', { name: 'Обработка микрофона' }).uncheck();
    await page.reload();
    await open();
    assert.equal(await select.inputValue(), 'gigaam-ctc-int8');
    assert.equal(
      await page
        .getByRole('checkbox', { name: 'Обработка микрофона' })
        .isChecked(),
      false,
    );
    await page
      .getByRole('button', { name: 'Проверить распознавание', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Завершить запись', exact: true })
      .waitFor();
    assert.match(
      await page.locator('.speech-settings').innerText(),
      /шумоподавление — выкл.*автогромкость — выкл.*эхо — выкл/,
    );
    await page
      .locator('.speech-settings')
      .screenshot({
        path: path.join(root, `.local/speech-tests/settings-${width}.png`),
      });
    assert(
      await page
        .locator('.parent-dialog')
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      'no horizontal overflow',
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(() =>
      window.testStreams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    );
    await page.locator('.speech-settings').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `PASS speech settings ${width}: seven models, persistence, raw capture flags, closed microphone and no overflow`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
