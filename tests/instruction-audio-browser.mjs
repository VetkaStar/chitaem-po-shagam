/** Turning off instruction speech must not disable a listen-mode exercise. */
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
  await page.addInitScript(() => {
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
  await page.getByLabel('Как тебя называть?').fill('Проверка звука');
  await page.getByLabel('Сколько тебе лет?').selectOption('7');
  await page.getByRole('button', { name: 'Продолжить →', exact: true }).click();
  await page
    .getByRole('button', { name: 'Настроить программу', exact: true })
    .click();
  await page
    .getByLabel('Можно пользоваться озвучкой и понимать её?')
    .selectOption('true');
  await page.getByLabel('Озвучка инструкции').selectOption('off');
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await page
    .getByRole('button', { name: 'Настроить позже', exact: true })
    .click();
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
    .locator('.portal-grid')
    .getByRole('button', { name: /^Выбираем ответ/ })
    .click();
  await page
    .getByLabel('Как заниматься')
    .selectOption('listen');
  await page
    .getByRole('button', { name: 'Начать занятие', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Послушать материал', exact: true })
    .waitFor();
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
  const target = await page.locator('.curriculum-material').innerText();
  await page
    .getByRole('button', { name: 'Послушать материал', exact: true })
    .click();
  await page.waitForFunction(() => window.testSpoken.length > 0);
  assert.ok((await page.evaluate(() => window.testSpoken)).includes(target));
  const reveal = page.getByRole('button', {
    name: 'Открыть варианты ответа',
    exact: true,
  });
  if (await reveal.count()) await reveal.click();
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
      'listen material is spoken while instruction button and automatic speech stay off',
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
