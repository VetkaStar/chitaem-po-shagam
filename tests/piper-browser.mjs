/** Opt-in real browser TTS integration: downloads model weights, generates and plays Russian speech. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
const out = path.join(root, '.local/piper-tests');
fs.mkdirSync(out, { recursive: true });
const server = await preview({
  configFile: path.join(root, 'vite.pages.config.ts'),
  preview: { host: '127.0.0.1', port: 3039, strictPort: true },
  logLevel: 'error',
});
const browser = await chromium.launchPersistentContext(
  path.join(out, 'profile'),
  { headless: true, channel: 'msedge', viewport: { width: 390, height: 1000 } },
);
try {
  const page = await browser.newPage();
  page.on('console', (message) => {
    fs.appendFileSync(
      path.join(out, 'console.log'),
      message.type() + ': ' + message.text() + '\n',
    );
    if (message.type() === 'error') console.log(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => console.log('PAGEERROR', error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('reading-profile-v1')) {
      localStorage.setItem(
        'reading-profile-v1',
        JSON.stringify({ name: 'Озвучка', age: '8', start: 'words' }),
      );
      localStorage.setItem(
        'reading-steps-v3',
        JSON.stringify({
          settings: { sound: true, styleChosen: true, layout: 'order' },
          stars: 0,
        }),
      );
    }
    window.testAudio = [];
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob.type?.startsWith('audio/')) window.testAudio.push(blob);
      return original(blob);
    };
  });
  await page.goto('http://127.0.0.1:3039');
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
  };
  await open();
  await page.locator('#narrator-engine').selectOption('piper-irina');
  await page.reload();
  await open();
  assert.equal(
    await page.locator('#narrator-engine').inputValue(),
    'piper-irina',
  );
  await page
    .locator('#narrator-sample')
    .fill('Маша нашла шишку. Жук жужжит. Ма. Ша. Жу. Ща.');
  const started = Date.now();
  await page
    .getByRole('button', { name: 'Послушать голос', exact: true })
    .click();
  await page.waitForFunction(
    () =>
      window.testAudio.length > 0 ||
      (
        document.querySelector('.narrator-settings [role=status]')
          ?.textContent || ''
      ).match(/ошиб|failed|Error|успел|Could|Не удалось/i),
    null,
    { timeout: 200000 },
  );
  const count = await page.evaluate(() => window.testAudio.length);
  if (!count)
    throw new Error(await page.locator('.narrator-settings').innerText());
  const bytes = await page.evaluate(async () => [
    ...new Uint8Array(await window.testAudio[0].arrayBuffer()),
  ]);
  fs.writeFileSync(path.join(out, 'irina.wav'), Buffer.from(bytes));
  assert(bytes.length > 20000, 'nonempty generated audio');
  await page.waitForFunction(
    () =>
      document.querySelector('.narrator-settings [role=status]')
        ?.textContent === 'Готово.',
    null,
    { timeout: 60000 },
  );
  for (const width of [390, 820, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page
      .locator('.narrator-settings')
      .screenshot({ path: path.join(out, `settings-${width}.png`) });
    assert(
      await page
        .locator('.parent-dialog')
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    );
  }
  await page
    .getByRole('button', { name: 'Послушать голос', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Остановить озвучку', exact: true })
    .click();
  assert.equal(
    await page.locator('.narrator-settings [role=status]').innerText(),
    'Остановлено.',
  );
  await page.keyboard.press('Escape');
  await page.locator('.narrator-settings').waitFor({ state: 'hidden' });
  console.log(
    JSON.stringify({
      passed: true,
      bytes: bytes.length,
      elapsedMs: Date.now() - started,
      wav: path.join(out, 'irina.wav'),
    }),
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
