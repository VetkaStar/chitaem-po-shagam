/** Words answer mode keeps material and option speech when instructions are muted. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  server: {
    host: '127.0.0.1',
    port: 0,
    hmr: false,
    forwardConsole: false,
    fs: { allow: [root] },
  },
  logLevel: 'error',
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/lib/piper-speech.ts*', (route) => route.fulfill({ contentType: 'text/javascript', body: `
    export function stopPiperSpeech() {}
    export function speakPiper(text, options = {}) {
      window.testSpoken.push(text);
      queueMicrotask(() => options.onEnd?.());
    }
  ` }));
  await page.addInitScript(() => {
    if (!localStorage.getItem('reading-profile-v1')) {
      localStorage.setItem('reading-profile-v1', JSON.stringify({ name: 'Проверка звука', age: '7', start: 'words' }));
      localStorage.setItem('reading-steps-v3', JSON.stringify({ settings: { styleChosen: true, sound: true, autoSpeech: false, layout: 'order', unit: 12, curriculumVersion: 2 }, stars: 0, history: [] }));
    }
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
  await page.goto(base);
  await page.getByRole('heading', { name: 'Все тренажёры', exact: true }).waitFor();
  // Persist the existing instruction preference through the real controller. The short entry has its own suite.
  await page.evaluate(async (sourceRoot) => {
    const { loadBundledSupply } = await import(sourceRoot + '/lib/curriculum/bundled.ts');
    const { IndexedDbProgressStore } = await import(sourceRoot + '/lib/progress/indexed-db.ts');
    const { CurriculumController } = await import(sourceRoot + '/features/curriculum/controller.ts');
    const { browserStorage } = await import(sourceRoot + '/lib/progress/profile-storage.ts');
    const supply = await loadBundledSupply();
    const store = new IndexedDbProgressStore(supply);
    const controller = await CurriculumController.open(supply, store, browserStorage);
    await controller.saveQuestionnaire({ ...controller.snapshot().onboarding.questionnaire, audioUsable: true, instructionAudio: 'off' }, null);
    await store.close();
  }, '/@fs/' + root.replaceAll('\\', '/'));
  await page
    .getByRole('heading', { name: 'Все тренажёры', exact: true })
    .waitFor();
  assert.equal(
    await page.locator('.app-root').getAttribute('data-audio'),
    'on',
    'instruction preference must not mute global material sound',
  );
  await page
    .locator('.portal-grid')
    .getByRole('button', { name: /ШАГ 3 Слова/ })
    .click();
  await page
    .getByRole('region', { name: 'Тренажёры раздела Слова', exact: true })
    .getByRole('button', { name: 'Целое слово', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
  await page
    .getByRole('button', { name: 'Послушать слово', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Начать занятие', exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByLabel('Как заниматься').count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: 'Послушать инструкцию', exact: true })
      .count(),
    0,
  );
  assert.deepEqual(
    await page.evaluate(() => window.testSpoken),
    [],
    'off must not auto-speak instructions',
  );
  // Flex letter spans insert layout line breaks into innerText, unlike the spoken word.
  const target = (await page.locator('.answer-material').textContent()).trim();
  await page
    .getByRole('button', { name: 'Послушать слово', exact: true })
    .click();
  await page.waitForFunction(() => window.testSpoken.length > 0);
  assert.ok((await page.evaluate(() => window.testSpoken)).includes(target));
  assert.equal(
    await page
      .getByRole('button', {
        name: 'Открыть варианты ответа',
        exact: true,
      })
      .count(),
    0,
    'answer mode reveals options durably before showing the card',
  );
  const audioOption = page
    .getByRole('button', { name: /^Послушать вариант/ })
    .first();
  await audioOption.waitFor();
  const spokenBefore = await page.evaluate(() => window.testSpoken.length);
  await audioOption.click();
  await page.waitForFunction(
    (before) => window.testSpoken.length > before,
    spokenBefore,
  );
  assert.equal(
    await page.locator('.curriculum-option[aria-pressed="true"]').count(),
    0,
  );
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    completed: [
      'instruction off leaves global sound enabled after questionnaire preferences',
      'word sample is spoken while instruction button and automatic speech stay off',
      'option audio remains available and does not select an answer',
    ],
  };
  const output = path.join(root, '.local/instruction-audio-browser');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
