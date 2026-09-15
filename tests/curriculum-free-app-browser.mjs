/** Smoke the actual static app and its IndexedDB ledger in a disposable browser context. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { normalise } from '../lib/curriculum/vendor/source/normalise.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const reportDir = path.join(root, '.local/curriculum-free-app-browser');
fs.mkdirSync(reportDir, { recursive: true });
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  base: '/base/',
  server: {
    host: '127.0.0.1',
    hmr: false,
    forwardConsole: false,
    port: 0,
    fs: { allow: [root] },
  },
  logLevel: 'error',
});
await server.listen();
const address = 'http://127.0.0.1:' + server.httpServer.address().port;
const completed = [],
  errors = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Проверка', age: '7', start: 'letters' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: {
          unit: 12,
          curriculumVersion: 2,
          layout: 'order',
          look: 'plain',
          paper: 'main',
          styleChosen: true,
          sound: true,
          autoSpeech: false,
          motion: false,
          breakEvery: 0,
          breakMinutes: 0,
          autoAdvance: false,
          color: false,
        },
        stars: 0,
        history: [],
        recentWords: {},
      }),
    );
    window.testSpoken = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices() {
          return [];
        },
        speak(utterance) {
          window.testSpoken.push(utterance.text);
          queueMicrotask(() => utterance.onend?.());
        },
        addEventListener() {},
        removeEventListener() {},
      },
    });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  const saved = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('reading-platform-v1', 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('state', 'readonly');
            const read = tx.objectStore('state').get('local');
            read.onsuccess = () => resolve(read.result);
            read.onerror = () => reject(read.error);
            tx.oncomplete = () => db.close();
          };
        }),
    );
  async function ready() {
    await page.locator('.exercise').first().waitFor();
    await page.waitForFunction(
      () => !document.querySelector('.free-material.is-pending'),
    );
  }
  async function select(name) {
    await page
      .getByRole('navigation', { name: 'Разделы', exact: true })
      .getByRole('button', { name: new RegExp(name + '$') })
      .click();
    await ready();
  }
  await page.goto(address + '/base/');
  await page
    .getByRole('navigation', { name: 'Разделы', exact: true })
    .waitFor();
  for (const name of [
    'Буквы',
    'Слоги',
    'Слова',
    'Картинки',
    'Предложения',
    'Рассказы',
    'Стихи',
  ]) {
    await select(name);
    const state = await saved();
    assert.equal(
      state.sourceEvents.some(
        (event) => event.kind === 'free_exposure' && event.source === 'free',
      ),
      true,
    );
    assert.equal(state.profile.exposures.events.length > 0, true);
    assert.equal(state.profile.attempts.length, 0);
    assert.equal(
      state.sourceEvents.every((event) => event.source === 'free'),
      true,
    );
    assert.equal(await page.locator('.exercise').first().isVisible(), true);
    completed.push('actual section and persisted free ledger: ' + name);
  }
  await select('Слоги');
  await page.getByRole('tab', { name: 'Ловлю', exact: true }).click();
  await ready();
  const cards = await page.locator('.catch-token').allTextContents();
  assert.equal(cards.length > 0, true);
  let state = await saved();
  for (const card of cards)
    assert.equal(
      state.profile.exposures.stimuli.includes(normalise(card)),
      true,
    );
  completed.push('all displayed moving syllable cards are recorded');

  await select('Слова');
  const word = await page
    .locator('.reading')
    .first()
    .getAttribute('data-letters');
  assert.equal(Number(word) > 0, true);
  const before = (await saved()).profile.exposures.events.length;
  await page
    .getByRole('button', { name: 'Послушать образец', exact: true })
    .click();
  await page.waitForFunction(() => window.testSpoken.length > 0);
  state = await saved();
  assert.equal(state.profile.exposures.events.length > before, true);
  const spoken = await page.evaluate(() => window.testSpoken.at(-1));
  assert.equal(
    state.profile.exposures.events.some((entry) =>
      entry.promptedTexts.includes(normalise(spoken)),
    ),
    true,
  );
  completed.push(
    'real word sample records assistance before mocked speech playback',
  );

  await select('Картинки');
  assert.equal(
    await page.locator('.illustration-gallery img').first().isVisible(),
    true,
  );
  assert.equal(
    (await saved()).profile.exposures.events.at(-1).promptedTexts.length > 0,
    true,
  );
  completed.push('picture material opens with a persisted visual prompt');

  await select('Рассказы');
  const menu = page
    .locator('details.practice-menu')
    .filter({ has: page.locator('summary', { hasText: 'Выбрать текст' }) });
  await menu.locator('summary').click();
  await page.waitForFunction(
    () => !document.querySelector('.free-material.is-pending'),
  );
  await menu.locator('.portal-grid button').first().waitFor();
  const titles = await menu.locator('.portal-grid button').allTextContents();
  state = await saved();
  for (const title of titles)
    assert.equal(
      state.profile.exposures.stimuli.includes(normalise(title)),
      true,
    );
  completed.push('opened story catalogue records every displayed title');
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: path.join(reportDir, 'actual-app.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify(
      { completed, errors, events: state.profile.exposures.events.length },
      null,
      2,
    ),
  );
  console.log(`PASS actual free app browser: ${completed.length} scenarios`);
} finally {
  await browser?.close();
  await server.close();
}
