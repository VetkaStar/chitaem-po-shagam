/** Profile isolation through the public UI, including a concurrently open legacy tab. */
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
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  await context.addInitScript(() => {
    if (localStorage.getItem('profile-test-seeded')) return;
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Первый ребёнок', age: '8', start: 'syllables' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: {
          styleChosen: true,
          sound: false,
          unit: 12,
          curriculumVersion: 2,
        },
        stars: 37,
        history: [],
      }),
    );
    localStorage.setItem('profile-test-seeded', 'yes');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page
    .getByRole('heading', { name: 'Привет, Первый ребёнок!' })
    .waitFor();
  const sibling = await context.newPage();
  sibling.on('pageerror', (error) => errors.push(error.message));
  await sibling.goto(base);
  await sibling
    .getByRole('heading', { name: 'Привет, Первый ребёнок!' })
    .waitFor();
  async function stars(tab, expected) {
    assert.equal(
      await tab.locator('.app-bar-stars').getAttribute('aria-label'),
      'Звёзд: ' + expected,
    );
  }
  async function logout(tab) {
    await tab
      .locator('.app-bar')
      .getByRole('button', { name: 'Мой кабинет', exact: true })
      .click();
    await tab
      .getByRole('button', { name: 'Выйти из профиля', exact: true })
      .click();
    await tab.getByRole('heading', { name: 'Кто будет заниматься?' }).waitFor();
  }
  async function questionnaire(tab, method) {
    await tab
      .getByRole('button', { name: 'Настроить программу', exact: true })
      .click();
    await tab
      .getByLabel('Какой способ хочешь попробовать?')
      .selectOption(method);
    await tab.waitForFunction(
      () =>
        document
          .querySelector('.curriculum-session')
          ?.getAttribute('aria-busy') !== 'true',
    );
    await tab
      .getByRole('button', { name: 'Настроить позже', exact: true })
      .click();
    await tab
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
  }
  await stars(page, 37);
  await sibling
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .click();
  await questionnaire(sibling, 'method_syllable_first');
  await logout(page);
  await page.reload();
  await page.getByRole('heading', { name: 'Кто будет заниматься?' }).waitFor();
  await sibling
    .getByRole('heading', { name: 'Привет, Первый ребёнок!' })
    .waitFor();
  await stars(sibling, 37);
  completed.push(
    'logout and picker reload preserve the other tab and legacy stars',
  );
  await page
    .getByRole('button', { name: 'Создать новый профиль', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Давай знакомиться' }).waitFor();
  await page.getByLabel('Как тебя называть?').fill('Второй ребёнок');
  await page.getByLabel('Сколько тебе лет?').selectOption('6');
  await page.getByRole('button', { name: 'Продолжить →', exact: true }).click();
  await questionnaire(page, 'method_word_first');
  await stars(page, 0);
  await stars(sibling, 37);
  const newId = await page.evaluate(() =>
    sessionStorage.getItem('reading-active-profile-v1'),
  );
  assert.ok(newId && newId !== 'legacy' && newId !== 'signed-out');
  assert.equal(
    await sibling.evaluate(() =>
      sessionStorage.getItem('reading-active-profile-v1'),
    ),
    'legacy',
  );
  const databases = await page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
  assert.ok(databases.includes('reading-platform-v1'));
  assert.ok(databases.includes('reading-platform-v1-' + newId));
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('reading-steps-v3')).stars,
    ),
    37,
  );
  completed.push(
    'new profile starts at zero with separate session selection and IndexedDB',
  );
  await logout(page);
  await page
    .getByRole('button', {
      name: 'Первый ребёнок Продолжить занятия',
      exact: true,
    })
    .click();
  await page
    .getByRole('heading', { name: 'Привет, Первый ребёнок!' })
    .waitFor();
  await stars(page, 37);
  await page
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Настроить программу', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Какой способ хочешь попробовать?').inputValue(),
    'method_syllable_first',
  );
  await page
    .getByRole('button', { name: 'Настроить позже', exact: true })
    .click();
  await logout(page);
  await page
    .getByRole('button', {
      name: 'Второй ребёнок Продолжить занятия',
      exact: true,
    })
    .click();
  await page
    .getByRole('heading', { name: 'Привет, Второй ребёнок!' })
    .waitFor();
  await stars(page, 0);
  await page
    .getByRole('button', { name: 'Учебные программы', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Настроить программу', exact: true })
    .click();
  assert.equal(
    await page.getByLabel('Какой способ хочешь попробовать?').inputValue(),
    'method_word_first',
  );
  await sibling.reload();
  await sibling
    .getByRole('heading', { name: 'Привет, Первый ребёнок!' })
    .waitFor();
  await stars(sibling, 37);
  completed.push(
    'switching restores each profile questionnaire; second tab keeps its own profile after reload',
  );
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), completed, databases };
  const output = path.join(root, '.local/profile-switch-browser');
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
