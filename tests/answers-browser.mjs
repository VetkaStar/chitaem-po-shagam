import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..'),
  require = createRequire(import.meta.url);
const bank = JSON.parse(
  fs.readFileSync(
    path.join(root, 'content/curriculum/curriculum.json'),
    'utf8',
  ),
);
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
const output = path.join(root, '.local/answers-browser');
fs.mkdirSync(output, { recursive: true });
let browser;
const completed = [];
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      if (!localStorage.getItem('reading-profile-v1')) {
        localStorage.setItem(
          'reading-profile-v1',
          JSON.stringify({ name: 'Ответы', age: '8', start: 'words' }),
        );
        localStorage.setItem(
          'reading-steps-v3',
          JSON.stringify({
            settings: {
              styleChosen: true,
              sound: false,
              layout: 'order',
              unit: 12,
              length: 3,
              curriculumVersion: 2,
            },
            stars: 37,
            history: [],
          }),
        );
      }
    });
    const state = () =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('reading-platform-v1');
            r.onerror = () => reject(r.error);
            r.onsuccess = () => {
              const db = r.result;
              const q = db
                .transaction('state', 'readonly')
                .objectStore('state')
                .get('local');
              q.onsuccess = () => {
                resolve(q.result);
                db.close();
              };
              q.onerror = () => reject(q.error);
            };
          }),
      );
    const geometry = () =>
      page.evaluate(() =>
        Object.fromEntries(
          [
            '.app-bar',
            '.lesson-top',
            '.topic-navigation',
            '.lesson-controls',
          ].map((s) => {
            const r = document.querySelector(s)?.getBoundingClientRect();
            return [
              s,
              r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null,
            ];
          }),
        ),
      );
    await page.goto(base);
    await page
      .locator('.portal-grid')
      .getByRole('button', { name: /ШАГ 3 Слова/ })
      .click();
    await page
      .locator('.portal-grid')
      .getByRole('button', { name: 'Целое слово', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    assert.equal(
      await page
        .getByRole('tab', { name: 'Отвечаю', exact: true })
        .getAttribute('aria-selected'),
      'true',
    );
    await page.getByRole('tab', { name: 'Читаю', exact: true }).click();
    await page.locator('.exercise').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await geometry();
    await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    await page.evaluate(() => window.scrollTo(0, 0));
    const after = await geometry();
    for (const selector of Object.keys(before))
      for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(
          Math.abs(before[selector][key] - after[selector][key]) <= 1,
          width +
            ' geometry ' +
            selector +
            ' ' +
            key +
            ': ' +
            JSON.stringify({ before, after }),
        );
    await page.screenshot({
      path: path.join(output, width + '-answer.png'),
      fullPage: true,
    });
    let saved = await state(),
      route = saved.customRoutes[saved.route.routeId];
    const firstId = route.steps[route.position].itemId,
      task = bank.items[firstId];
    for (const id of task.answer.correctOptionIds)
      await page
        .locator('.answer-exercise .curriculum-options')
        .getByRole('button', {
          name: task.options.find((o) => o.id === id).text,
          exact: true,
        })
        .click();
    await page.getByRole('button', { name: 'Ответить', exact: true }).click();
    await page.getByRole('heading', { name: 'Верно!', exact: true }).waitFor();
    saved = await state();
    assert.equal(saved.customRoutes[route.routeId].position, 1);
    await page.keyboard.press('Enter');
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Задание пропущено', exact: true })
      .waitFor();
    await page
      .getByRole('button', { name: 'Дальше · Enter', exact: true })
      .click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    const material = await page.locator('.answer-material').innerText();
    await page.getByRole('tab', { name: 'Читаю', exact: true }).click();
    await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    assert.equal(await page.locator('.answer-material').innerText(), material);
    saved = await state();
    assert.equal(saved.customRoutes[route.routeId].position, 2);
    const activeInstance = saved.profile.activeInstance.instanceId;
    await page.reload();
    await page
      .locator('.portal-grid')
      .getByRole('button', { name: /ШАГ 3 Слова/ })
      .click();
    await page
      .locator('.portal-grid')
      .getByRole('button', { name: 'Целое слово', exact: true })
      .click();
    await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    assert.equal(
      (await state()).profile.activeInstance.instanceId,
      activeInstance,
    );
    assert.equal(await page.locator('.answer-material').innerText(), material);
    await page
      .getByRole('button', { name: 'Выбрать другую тему', exact: true })
      .click();
    await page.locator('.topic-options').getByRole('button').first().click();
    await page.waitForFunction(
      () =>
        document.querySelector('.answer-material')?.textContent?.trim() ===
          'МАМА' ||
        document.body.textContent.includes('В этой теме пока нет вопросов.'),
    );
    saved = await state();
    assert.equal(saved.customRoutes[route.routeId].position, 2);
    const topicRoute = Object.values(saved.customRoutes).find((r) =>
      r.routeId.startsWith('answer:words:0:'),
    );
    if (topicRoute)
      for (const step of topicRoute.steps)
        assert.match(bank.items[step.itemId].learnerText, /^[АУМау м]+$/u);
    await page
      .getByRole('button', { name: 'Выбрать другую тему', exact: true })
      .click();
    await page.locator('.topic-options').getByRole('button').last().click();
    await page
      .locator('.answer-exercise')
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
    assert.equal(await page.locator('.answer-material').innerText(), material);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      width + ' overflow',
    );
    await page
      .getByRole('button', { name: 'Следующая тема: Картинки', exact: true })
      .click();
    await page.getByRole('group', { name: 'Режим картинок' }).waitFor();
    assert.equal(await page.locator('.answer-exercise').count(), 0);
    assert.equal(
      await page.getByRole('tab', { name: 'Отвечаю', exact: true }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    completed.push(
      width +
        ': card/tab entry, stable header/topic/controls, correct and Enter, skip, reload instance, topic isolation, Pictures boundary',
    );
    await page.close();
  }
  const focus = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await focus.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Фокус', age: '8', start: 'words' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: {
          styleChosen: true,
          sound: false,
          layout: 'focus',
          look: 'notebook',
          unit: 12,
          length: 3,
          curriculumVersion: 2,
        },
        stars: 37,
        history: [],
      }),
    );
  });
  await focus.goto(base);
  await focus
    .locator('.portal-grid')
    .getByRole('button', { name: /ШАГ 3 Слова/ })
    .click();
  await focus
    .locator('.portal-grid')
    .getByRole('button', { name: 'Целое слово', exact: true })
    .click();
  await focus.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
  await focus.locator('.answer-exercise').waitFor();
  assert.equal(await focus.locator('.focus-bar').count(), 1);
  assert.equal(
    await focus.locator('html').getAttribute('data-look'),
    'notebook',
  );
  assert.equal(await focus.getByRole('tab').count(), 4);
  assert.equal(
    await focus.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    'focus notebook overflow',
  );
  await focus.screenshot({
    path: path.join(output, '390-focus-notebook.png'),
    fullPage: true,
  });
  await focus.close();
  completed.push(
    '390 focus notebook: four tabs, focus header, no horizontal overflow',
  );
  const report = { date: new Date().toISOString(), completed };
  fs.writeFileSync(
    path.join(output, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
