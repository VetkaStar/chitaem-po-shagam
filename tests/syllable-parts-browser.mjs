/** Syllable composition shares the lesson shell and resumes without a setup screen. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
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
const output = path.join(root, '.local/syllable-parts-browser');
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
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (localStorage.getItem('reading-profile-v1')) return;
      localStorage.setItem(
        'reading-profile-v1',
        JSON.stringify({ name: 'Состав слога', age: '8', start: 'syllables' }),
      );
      localStorage.setItem(
        'reading-steps-v3',
        JSON.stringify({
          settings: {
            styleChosen: true,
            autoAdvance: false,
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
    });
    const state = () =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const request = indexedDB.open('reading-platform-v1');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const query = db
                .transaction('state', 'readonly')
                .objectStore('state')
                .get('local');
              query.onsuccess = () => {
                resolve(query.result);
                db.close();
              };
              query.onerror = () => reject(query.error);
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
          ].map((selector) => {
            const bounds = document
              .querySelector(selector)
              ?.getBoundingClientRect();
            return [
              selector,
              bounds
                ? {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height,
                  }
                : null,
            ];
          }),
        ),
      );
    const navigate = async (title) => {
      const toggle = page.getByRole('button', {
        name: 'Открыть меню',
        exact: true,
      });
      if (
        (await toggle.isVisible()) &&
        (await page.locator('.app-nav').getAttribute('data-open')) === null
      )
        await toggle.click();
      const section = page
        .locator('.app-nav-group')
        .filter({ has: page.locator('.app-nav-item', { hasText: 'Слоги' }) });
      if (
        (await section
          .locator('.app-nav-item')
          .getAttribute('aria-expanded')) !== 'true'
      )
        await section.locator('.app-nav-item').click();
      await section.getByRole('button', { name: title, exact: true }).click();
    };
    const ready = async () => {
      await page
        .locator('.syllable-parts-exercise')
        .waitFor()
        .catch(async (error) => {
          console.error(await page.locator('.app-content').innerText());
          throw error;
        });
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(
        await page
          .getByRole('heading', { name: 'Новое занятие', exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByText('Есть незавершённое занятие', { exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page
          .getByRole('button', { name: 'Начать занятие', exact: true })
          .count(),
        0,
      );
      assert.equal(
        await page.getByText('Как заниматься', { exact: true }).count(),
        0,
      );
    };
    await page.goto(base);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    await navigate('Слог');
    await page.locator('.exercise').waitFor();
    await page
      .getByRole('heading', { name: 'Соединяем звуки', exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole('tab', { name: 'Читаю', exact: true })
        .getAttribute('aria-selected'),
      'true',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await geometry();
    await navigate('Состав слога');
    await ready();
    assert.deepEqual(
      (await page.getByRole('tab').allTextContents()).map((text) =>
        text.trim(),
      ),
      ['Собираем', 'Находим часть'],
    );
    const after = await geometry();
    for (const selector of Object.keys(before)) {
      assert.ok(before[selector] && after[selector], selector + ' is shared');
      for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(
          Math.abs(before[selector][key] - after[selector][key]) <= 1,
          width +
            ' shell mismatch ' +
            selector +
            ' ' +
            key +
            ': ' +
            JSON.stringify({ before, after }),
        );
    }
    if (width === 1920) {
      const layout = await page
        .locator('.syllable-parts-exercise')
        .evaluate((card) =>
          [card, ...card.querySelectorAll('*')]
            .filter(
              (element) =>
                element.children.length ||
                element.matches('button, legend, output, p'),
            )
            .map((element) => {
              const style = getComputedStyle(element),
                rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                class: element.className,
                text: element.textContent.slice(0, 55),
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                margin: style.margin,
                padding: style.padding,
                gap: style.gap,
                minHeight: style.minHeight,
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
              };
            }),
        );
      fs.writeFileSync(
        path.join(output, '1920-layout.json'),
        JSON.stringify(layout, null, 2),
      );
    }
    let saved = await state();
    const routeId = saved.route.routeId;
    const firstInstance = saved.profile.activeInstance;
    const firstRoute = saved.customRoutes[routeId];
    assert.ok(firstInstance, 'first exercise starts immediately');
    assert.ok(firstRoute.steps.length <= 3, 'uses adult session length');
    await page.screenshot({
      path: path.join(output, width + '-compose.png'),
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'Находим часть', exact: true }).click();
    await ready();
    saved = await state();
    assert.notEqual(saved.route.routeId, routeId, 'modes use their own route');
    await page.screenshot({
      path: path.join(output, width + '-find-part.png'),
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'Собираем', exact: true }).click();
    await ready();
    saved = await state();
    assert.equal(saved.route.routeId, routeId, 'return resumes previous route');
    assert.deepEqual(
      saved.profile.activeInstance,
      firstInstance,
      'return preserves current exercise',
    );
    await navigate('Слог');
    await page.locator('.exercise').waitFor();
    await page
      .getByRole('heading', { name: 'Соединяем звуки', exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole('tab', { name: 'Читаю', exact: true })
        .getAttribute('aria-selected'),
      'true',
    );
    await navigate('Состав слога');
    await ready();
    saved = await state();
    assert.equal(
      saved.route.routeId,
      routeId,
      'leaving the trainer preserves progress',
    );
    await page.locator('.practice-menu > summary').click();
    await page.locator('.practice-menu[open] .practice-menu-panel').waitFor();
    assert.equal(
      await page.getByRole('dialog').count(),
      0,
      'quick settings stay in the exercise',
    );
    assert.equal(
      await page
        .getByLabel('Автоматически переходить дальше', { exact: true })
        .count(),
      1,
    );
    assert.equal(
      await page
        .getByLabel('Задержка автоперехода в секундах', { exact: true })
        .count(),
      1,
    );
    assert.ok(
      await page.locator('.practice-menu-panel select').count(),
      'session length is available in exercise settings',
    );
    await page.locator('.practice-menu > summary').click();
    await ready();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      width + ' overflow',
    );
    if (width === 1920) {
      await page
        .locator('.app-bar')
        .getByRole('button', { name: 'Для взрослого', exact: true })
        .click();
      await page
        .getByRole('heading', { name: 'Настроим занятие', exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole('dialog')
          .getByLabel('Автоматически переходить дальше', { exact: true })
          .count(),
        1,
      );
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await page.locator('.topic-list').click();
    await page
      .getByRole('button', { name: '1. А, У и М', exact: true })
      .click();
    await ready();
    saved = await state();
    assert.notEqual(saved.route.routeId, routeId, 'topic uses its own route');
    for (const step of saved.customRoutes[saved.route.routeId].steps) {
      const task = bank.items[step.itemId];
      const letters =
        (task.requiredLetters + task.learnerText)
          .toUpperCase()
          .match(/[А-ЯЁ]/gu) ?? [];
      assert.ok(
        letters.every((letter) => 'АУМ'.includes(letter)),
        'first topic must not expose later letters: ' + task.id,
      );
    }
    await page.locator('.topic-list').click();
    await page
      .getByRole('button', { name: '13. Весь алфавит', exact: true })
      .click();
    await ready();
    saved = await state();
    assert.equal(
      saved.route.routeId,
      routeId,
      'returning to topic resumes the original exercise',
    );
    const task = bank.items[firstRoute.steps[firstRoute.position].itemId];
    for (const part of task.partTokens) {
      const buttons = page.locator(
        '.syllable-parts-exercise .curriculum-token-bank button:not(:disabled)',
      );
      const wanted = buttons
        .filter({ hasText: new RegExp('^' + part.text + '$') })
        .first();
      await wanted.click();
    }
    await page
      .locator('.syllable-parts-exercise button[type="submit"]')
      .click();
    await page.locator('.syllable-parts-exercise .feedback.success').waitFor();
    await page
      .getByRole('heading', { name: 'Собери слог', exact: true })
      .waitFor();
    assert.equal(
      await page.locator('.trainer-material').textContent(),
      task.learnerText,
    );
    await page.screenshot({
      path: path.join(output, width + '-success.png'),
      fullPage: true,
    });
    saved = await state();
    assert.equal(
      saved.customRoutes[routeId].position,
      1,
      'correct assembly advances once',
    );
    await page.keyboard.press('Enter');
    await ready();
    saved = await state();
    assert.equal(
      saved.customRoutes[routeId].position,
      1,
      'Enter opens the next exercise without skipping it',
    );
    assert.notDeepEqual(
      saved.profile.activeInstance,
      firstInstance,
      'next exercise has a new instance',
    );
    const nextInstance = saved.profile.activeInstance;
    await page.reload();
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    await navigate('Состав слога');
    await ready();
    saved = await state();
    assert.equal(saved.route.routeId, routeId, 'reload preserves route');
    assert.deepEqual(
      saved.profile.activeInstance,
      nextInstance,
      'reload preserves current exercise',
    );
    const legacy = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('reading-steps-v3')),
    );
    assert.equal(
      legacy.stars,
      38,
      'one correct task awards one star without duplicate navigation rewards',
    );
    assert.deepEqual(
      legacy.trainerRewards,
      [firstInstance.instanceId],
      'reload preserves exactly one rewarded task receipt',
    );
    assert.deepEqual(errors, [], width + ' browser errors');
    completed.push(
      width +
        ': same shell, direct entry, two modes, preserved exercise, adult settings, no overflow',
    );
    await page.close();
  }
  const focus = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  await focus.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Фокус', age: '8', start: 'syllables' }),
    );
    localStorage.setItem(
      'reading-steps-v3',
      JSON.stringify({
        settings: {
          styleChosen: true,
          autoAdvance: false,
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
    .getByRole('button', { name: /ШАГ 2 Слоги/ })
    .click();
  await focus
    .locator('.portal-grid')
    .getByRole('button', { name: 'Состав слога', exact: true })
    .click();
  await focus.locator('.syllable-parts-exercise').waitFor();
  assert.equal(await focus.locator('.focus-bar').count(), 1);
  assert.equal(await focus.locator('.app-bar').isVisible(), false);
  assert.equal(
    await focus.locator('html').getAttribute('data-look'),
    'notebook',
  );
  await focus.locator('.topic-chip-open').click();
  await focus.getByRole('button', { name: '1. А, У и М', exact: true }).click();
  await focus.locator('.syllable-parts-exercise').waitFor();
  assert.equal(
    await focus.locator('.topic-chip-open strong').innerText(),
    'А, У и М',
  );
  await focus.getByRole('tab', { name: 'Находим часть', exact: true }).click();
  await focus.locator('.syllable-parts-exercise').waitFor();
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
    '390 focus notebook: shared focusbar, hidden global header, topic switch and two modes, no overflow',
  );
  const auto = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await auto.addInitScript(() => {
    localStorage.setItem(
      'reading-profile-v1',
      JSON.stringify({ name: 'Переходы', age: '8', start: 'syllables' }),
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
          autoAdvance: true,
          autoAdvanceSeconds: 1,
          curriculumVersion: 2,
        },
        stars: 37,
        history: [],
      }),
    );
  });
  await auto.goto(base);
  await auto
    .locator('.portal-grid')
    .getByRole('button', { name: /ШАГ 2 Слоги/ })
    .click();
  await auto
    .locator('.portal-grid')
    .getByRole('button', { name: 'Состав слога', exact: true })
    .click();
  await auto.locator('.syllable-parts-exercise').waitFor();
  const autoState = () =>
    auto.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open('reading-platform-v1');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const query = db
              .transaction('state', 'readonly')
              .objectStore('state')
              .get('local');
            query.onsuccess = () => {
              resolve(query.result);
              db.close();
            };
            query.onerror = () => reject(query.error);
          };
        }),
    );
  const solve = async () => {
    const snapshot = await autoState();
    const route = snapshot.customRoutes[snapshot.route.routeId];
    const task = bank.items[route.steps[route.position].itemId];
    const card = auto.locator('.syllable-parts-exercise');
    await card.evaluate((element) => {
      element.dataset.testIdentity = 'retained-card';
    });
    for (const part of task.partTokens) {
      await card
        .locator('.curriculum-token-bank button:not(:disabled)')
        .filter({ hasText: new RegExp('^' + part.text + '$') })
        .first()
        .click();
    }
    await card.locator('button[type="submit"]').click();
    await card.locator('.feedback.success').waitFor();
    assert.equal(
      await card.getAttribute('data-test-identity'),
      'retained-card',
      'success keeps the original card node',
    );
    assert.equal(
      await card.locator('.trainer-material').textContent(),
      task.learnerText,
    );
    await card
      .getByRole('heading', { name: 'Собери слог', exact: true })
      .waitFor();
    return task.learnerText;
  };
  const firstMaterial = await solve();
  await auto.locator('.practice-menu > summary').click();
  await auto
    .getByLabel('Задержка автоперехода в секундах', { exact: true })
    .waitFor();
  assert.equal(
    await auto
      .getByLabel('Задержка автоперехода в секундах', { exact: true })
      .inputValue(),
    '1',
  );
  await auto.waitForTimeout(1300);
  assert.equal(
    await auto.locator('.trainer-material').textContent(),
    firstMaterial,
    'open settings pause countdown',
  );
  assert.equal(await auto.locator('.feedback.success').count(), 1);
  await auto.screenshot({
    path: path.join(output, '1920-success-settings-paused.png'),
    fullPage: true,
  });
  await auto.locator('.practice-menu > summary').click();
  await auto
    .locator('.feedback.success')
    .waitFor({ state: 'detached', timeout: 5000 });
  await auto
    .locator('.syllable-parts-exercise button[type="submit"]')
    .waitFor();
  let snapshot = await autoState();
  assert.equal(
    snapshot.customRoutes[snapshot.route.routeId].position,
    1,
    'one-second automatic next opens second task',
  );
  assert.ok(snapshot.profile.activeInstance);
  await auto.screenshot({
    path: path.join(output, '1920-after-auto-next.png'),
    fullPage: true,
  });
  const secondMaterial = await solve();
  await auto
    .getByRole('button', { name: 'Не переходить', exact: true })
    .click();
  await auto.waitForTimeout(1300);
  assert.equal(
    await auto.locator('.trainer-material').textContent(),
    secondMaterial,
    'cancelled countdown retains successful task',
  );
  await auto.getByText('Автопереход остановлен', { exact: true }).waitFor();
  const starsAfterSecond = await auto.evaluate(
    () => JSON.parse(localStorage.getItem('reading-steps-v3')).stars,
  );
  assert.equal(starsAfterSecond, 39);
  await auto
    .getByRole('button', { name: 'Повторить задание', exact: true })
    .click();
  await auto.locator('.feedback.success').waitFor({ state: 'detached' });
  assert.equal(
    await auto.locator('.trainer-material').textContent(),
    secondMaterial,
  );
  await solve();
  await auto
    .getByRole('button', { name: 'Не переходить', exact: true })
    .click();
  assert.equal(
    await auto.evaluate(
      () => JSON.parse(localStorage.getItem('reading-steps-v3')).stars,
    ),
    starsAfterSecond,
    'repeating second task does not award another star',
  );
  await auto.getByRole('button', { name: /Дальше/ }).focus();
  await auto.keyboard.press('Enter');
  await auto.locator('.feedback.success').waitFor({ state: 'detached' });
  await auto.locator('.practice-menu > summary').click();
  await auto
    .getByLabel('Автоматически переходить дальше', { exact: true })
    .uncheck();
  await auto.locator('.practice-menu > summary').click();
  await solve();
  assert.equal(
    await auto
      .getByRole('heading', { name: 'Ты позанимался. Здорово!', exact: true })
      .count(),
    0,
    'last success is shown before summary',
  );
  await auto.screenshot({
    path: path.join(output, '1920-last-success.png'),
    fullPage: true,
  });
  const starsAfterThree = await auto.evaluate(
    () => JSON.parse(localStorage.getItem('reading-steps-v3')).stars,
  );
  assert.equal(
    starsAfterThree,
    40,
    'three new correct tasks award three stars',
  );
  await auto
    .getByRole('button', { name: 'Повторить задание', exact: true })
    .click();
  await auto.locator('.feedback.success').waitFor({ state: 'detached' });
  await solve();
  assert.equal(
    await auto.evaluate(
      () => JSON.parse(localStorage.getItem('reading-steps-v3')).stars,
    ),
    starsAfterThree,
    'repeating a completed task does not award another star',
  );
  await auto.getByRole('button', { name: /Дальше/ }).focus();
  await auto.keyboard.press('Enter');
  await auto
    .getByRole('heading', { name: 'Ты позанимался. Здорово!', exact: true })
    .waitFor();
  assert.equal(await auto.locator('.syllable-parts-exercise').count(), 0);
  await auto.close();
  completed.push(
    'success: same card/material, quick settings pause 1s countdown, automatic next, cancellation, explicit final summary',
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
