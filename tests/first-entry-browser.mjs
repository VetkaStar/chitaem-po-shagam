/** First profile creation and editing are different flows in the real application. */
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
const completed = [];
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
  await page.goto(base);
  await page.getByRole('heading', { name: 'Давай знакомиться' }).waitFor();
  await page.getByLabel('Как тебя называть?').fill('Тест первого входа');
  await page.getByLabel('Сколько тебе лет?').selectOption('7');
  await page.getByRole('button', { name: 'Продолжить →', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
    .waitFor();
  assert.equal(
    await page.locator('.exercise').count(),
    0,
    'profile creation must not start an exercise',
  );
  await page.reload();
  await page
    .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
    .waitFor();
  completed.push(
    'new profile opens short entry and resumes role screen after reload',
  );
  const backToRole = () => page.getByRole('button', { name: 'Назад к выбору «Кто отвечает?»', exact: true });
  await page.getByRole('button', { name: 'Ребёнок сам', exact: true }).click();
  await page.getByRole('heading', { name: 'Что тебе интересно?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Животные', exact: true }).click();
  await backToRole().click();
  await page.getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ребёнок сам', exact: true }).click();
  await page.getByRole('heading', { name: 'Что тебе интересно?', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Животные', exact: true }).getAttribute('aria-pressed'), 'true');
  await backToRole().click();
  completed.push('back to respondent survives reload, preserves interests and permits switching to adult');
  await page
    .getByRole('button', { name: 'Взрослый о ребёнке', exact: true })
    .click();
  await page
    .getByRole('heading', {
      name: 'Что уже получается читать самостоятельно?',
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByRole('heading', { name: /Сколько.*лет/ }).count(),
    0,
    'known age must not be repeated',
  );
  await page
    .getByRole('button', { name: 'Короткие слова', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Что сейчас труднее всего?', exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole('heading', { name: 'Что сейчас труднее всего?', exact: true })
    .waitFor();
  completed.push(
    'known age skipped and short questionnaire answer survives reload',
  );
  await page.getByRole('button', { name: 'К тренажёрам', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Все тренажёры', exact: true })
    .waitFor();
  assert.equal(await page.locator('.exercise').count(), 0);
  assert.equal(await page.locator('.portal-grid .portal-card').count(), 7);
  assert.equal(
    await page
      .getByRole('navigation', { name: 'Разделы', exact: true })
      .getByRole('button')
      .count(),
    7,
  );
  assert.equal(await page.locator('.app-nav-submenu:not([hidden])').count(), 0);
  await page.reload();
  await page
    .getByRole('heading', { name: 'Все тренажёры', exact: true })
    .waitFor();
  completed.push(
    'defer opens 7 sections with collapsed trainer submenus without an entry check',
  );
  await page
    .locator('.app-bar')
    .getByRole('button', { name: 'Мой кабинет', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Изменить имя и возраст', exact: true })
    .click();
  await page.getByLabel('Как тебя называть?').fill('Новое имя');
  await page
    .getByRole('button', { name: 'Сохранить изменения', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Новое имя, это твоё место' })
    .waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
      .count(),
    0,
  );
  await page.reload();
  await page.getByRole('heading', { name: 'Привет, Новое имя!' }).waitFor();
  completed.push(
    'editing a profile returns to cabinet without repeating first entry',
  );
  await page
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .click();
  await page
    .getByRole('heading', { name: 'Что сейчас труднее всего?', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('heading', {
        name: 'Что уже получается читать самостоятельно?',
        exact: true,
      })
      .count(),
    0,
  );
  completed.push(
    'deferred short entry screen and answers remain available after profile edit',
  );
  const failed = await browser.newPage();
  await failed.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('reading-profile-record-v1:'))
        throw new DOMException('Test quota error', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await failed.goto(base);
  await failed.getByLabel('Как тебя называть?').fill('Не сохранён');
  await failed.getByLabel('Сколько тебе лет?').selectOption('7');
  await failed
    .getByRole('button', { name: 'Продолжить →', exact: true })
    .click();
  await failed
    .getByRole('alert')
    .filter({ hasText: 'Браузер не разрешил сохранить профиль' })
    .waitFor();
  assert.equal(
    await failed.getByRole('heading', { name: 'Давай знакомиться' }).count(),
    1,
  );
  assert.equal(
    await failed
      .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
      .count(),
    0,
  );
  await failed.close();
  completed.push(
    'failed profile persistence keeps the form and does not enter curriculum',
  );
  const legacy = await browser.newPage();
  await legacy.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Старый профиль', age: '8', start: 'words' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: { styleChosen: true, sound: false },
        stars: 9,
        history: [],
      }),
    );
  });
  await legacy.goto(base);
  await legacy
    .getByRole('heading', { name: 'Привет, Старый профиль!' })
    .waitFor();
  assert.equal(
    await legacy
      .getByRole('heading', { name: 'Кто сейчас отвечает?', exact: true })
      .count(),
    0,
  );
  await legacy.close();
  completed.push(
    'existing legacy profiles open home without mandatory onboarding',
  );
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), completed };
  const output = path.join(root, '.local/first-entry-browser');
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
