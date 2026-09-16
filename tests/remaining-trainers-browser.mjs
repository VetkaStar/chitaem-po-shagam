/** Remaining standalone trainers use the common lesson flow and real controller. */
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
const output = path.join(root, '.local/remaining-trainers-browser');
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
        JSON.stringify({ name: 'Новые тренажёры', age: '8', start: 'words' }),
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
            autoAdvance: false,
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
    const navigate = async (sectionName, title) => {
      const toggle = page.getByRole('button', {
        name: 'Открыть меню',
        exact: true,
      });
      if (
        (await toggle.isVisible()) &&
        (await page.locator('.app-nav').getAttribute('data-open')) === null
      )
        await toggle.click();
      const section = page.locator('.app-nav-group').filter({
        has: page.locator('.app-nav-item', { hasText: sectionName }),
      });
      if (
        (await section
          .locator('.app-nav-item')
          .getAttribute('aria-expanded')) !== 'true'
      )
        await section.locator('.app-nav-item').click();
      await section.getByRole('button', { name: title, exact: true }).click();
    };
    const card = page.locator('.trainer-exercise');
    const ready = async () => {
      await card.waitFor().catch(async (error) => {
        console.error(await page.locator('.app-content').innerText());
        throw error;
      });
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
      for (const selector of [
        '.lesson-top',
        '.topic-navigation',
        '.lesson-controls',
      ])
        assert.equal(
          await page.locator(selector).count(),
          1,
          selector + ' is shared',
        );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        width + ' overflow',
      );
    };
    const solve = async (expectedKind) => {
      const saved = await state();
      const route = saved.customRoutes[saved.route.routeId];
      const task = bank.items[route.steps[route.position].itemId];
      assert.equal(task.kind, expectedKind);
      await card.evaluate((element) => {
        element.dataset.testIdentity = 'retained';
      });
      const heading = await card.locator('h2').innerText();
      if (task.kind === 'compose') {
        for (const part of task.partTokens)
          await card
            .locator('.curriculum-token-bank button:not(:disabled)')
            .filter({ hasText: new RegExp('^' + part.text + '$') })
            .first()
            .click();
      } else if (task.kind === 'boundary') {
        for (const index of task.answer.acceptedBoundaries[0])
          await card
            .getByRole('button', {
              name: 'Граница после буквы ' + index,
              exact: true,
            })
            .click();
      } else if (task.kind === 'find_part') {
        for (const segment of task.answer.segments) {
          await card
            .locator(
              '.curriculum-character[aria-label^="Строка ' +
                (segment.line + 1) +
                ', знак ' +
                (segment.start + 1) +
                ':"]',
            )
            .click();
          await card
            .locator(
              '.curriculum-character[aria-label^="Строка ' +
                (segment.line + 1) +
                ', знак ' +
                segment.end +
                ':"]',
            )
            .click();
        }
      } else if (task.kind === 'transform') {
        await card
          .getByLabel('Напиши, что получилось', { exact: true })
          .fill(task.answer.value);
      } else if (task.kind === 'read_meaning') {
        await card
          .getByRole('button', {
            name: 'Взрослый: прочитано верно',
            exact: true,
          })
          .click();
        await card
          .getByRole('button', { name: 'Открыть варианты ответа', exact: true })
          .click();
        for (const id of task.answer.correctOptionIds)
          await card
            .locator('.curriculum-options')
            .getByRole('button', {
              name: task.options.find((option) => option.id === id).text,
              exact: true,
            })
            .click();
      }
      await card.locator('button[type="submit"]').click();
      if (task.kind === 'transform' && task.requiresFollowupReading)
        await card
          .getByRole('button', {
            name: 'Взрослый: прочитано верно',
            exact: true,
          })
          .click();
      await card
        .locator('.feedback.success')
        .waitFor()
        .catch(async (error) => {
          console.error(task.id, await card.innerText());
          throw error;
        });
      assert.equal(
        await card.getAttribute('data-test-identity'),
        'retained',
        'success retains card',
      );
      assert.equal(
        await card.locator('h2').innerText(),
        heading,
        'success retains task heading',
      );
      const after = await state();
      assert.equal(
        after.customRoutes[route.routeId].position,
        route.position + 1,
        'one submission advances exactly once',
      );
      return { routeId: route.routeId, taskId: task.id };
    };
    await page.goto(base);
    await page
      .getByRole('heading', { name: 'Все тренажёры', exact: true })
      .waitFor();
    await navigate('Слова', 'Целое слово');
    await page
      .getByRole('heading', { name: 'Читаем целое слово', exact: true })
      .waitFor();
    await navigate('Слова', 'Состав слова');
    await ready();
    assert.deepEqual(
      (await page.getByRole('tab').allTextContents()).map((text) =>
        text.trim(),
      ),
      ['Собираем', 'Находим часть', 'Делим на части', 'Меняем'],
    );
    const routes = new Map();
    for (const [label, kind] of [
      ['Собираем', 'compose'],
      ['Находим часть', 'find_part'],
      ['Делим на части', 'boundary'],
      ['Меняем', 'transform'],
    ]) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await ready();
      await page.locator('.practice-menu > summary').click();
      await page
        .getByLabel('Автоматически переходить дальше', { exact: true })
        .waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(
        await page
          .getByLabel('Заданий в занятии', { exact: false })
          .inputValue(),
        '3',
      );
      await page.locator('.practice-menu > summary').click();
      await page.screenshot({
        path: path.join(output, width + '-words-' + kind + '.png'),
        fullPage: true,
      });
      const result = await solve(kind);
      await page.screenshot({
        path: path.join(output, width + '-words-' + kind + '-success.png'),
        fullPage: true,
      });
      await page.getByRole('button', { name: /Дальше/ }).focus();
      await page.keyboard.press('Enter');
      await card.locator('.feedback.success').waitFor({ state: 'detached' });
      await ready();
      const saved = await state();
      routes.set(kind, {
        id: result.routeId,
        instance: saved.profile.activeInstance,
      });
    }
    await page.getByRole('tab', { name: 'Собираем', exact: true }).click();
    await ready();
    let saved = await state();
    assert.equal(saved.route.routeId, routes.get('compose').id);
    assert.deepEqual(
      saved.profile.activeInstance,
      routes.get('compose').instance,
      'mode switch resumes the next saved exercise',
    );
    for (const [section, trainer, kind, slug] of [
      ['Слова', 'Читаем и понимаем', 'read_meaning', 'meaning'],
      ['Предложения', 'Состав предложения', 'find_part', 'sentence'],
      ['Рассказы', 'Состав текста', 'find_part', 'story'],
    ]) {
      await navigate(section, trainer);
      await ready();
      if (kind === 'read_meaning')
        assert.deepEqual(
          (await page.getByRole('tab').allTextContents()).map((text) =>
            text.trim(),
          ),
          ['Читаю', 'Слушаю', 'Вместе со взрослым'],
        );
      else
        assert.ok(
          (await page.getByRole('tab').count()) <= 1,
          'single task kind does not invent extra modes',
        );
      await page.screenshot({
        path: path.join(output, width + '-' + slug + '.png'),
        fullPage: true,
      });
      const result = await solve(kind);
      await page.screenshot({
        path: path.join(output, width + '-' + slug + '-success.png'),
        fullPage: true,
      });
      await page.getByRole('button', { name: /Дальше/ }).focus();
      await page.keyboard.press('Enter');
      await card.locator('.feedback.success').waitFor({ state: 'detached' });
      await ready();
      saved = await state();
      const active = saved.profile.activeInstance;
      await navigate('Слова', 'Целое слово');
      await page
        .getByRole('heading', { name: 'Читаем целое слово', exact: true })
        .waitFor();
      await navigate(section, trainer);
      await ready();
      saved = await state();
      assert.equal(saved.route.routeId, result.routeId);
      assert.deepEqual(
        saved.profile.activeInstance,
        active,
        trainer + ' resumes saved task',
      );
      if (kind === 'read_meaning') {
        for (const [label, presentationMode] of [
          ['Слушаю', 'listen'],
          ['Вместе со взрослым', 'shared'],
        ]) {
          await page.getByRole('tab', { name: label, exact: true }).click();
          await ready();
          const modeState = await state();
          assert.equal(modeState.profile.activeInstance.mode, presentationMode);
          await solve(kind);
          await page.screenshot({
            path: path.join(
              output,
              width + '-meaning-' + presentationMode + '-success.png',
            ),
            fullPage: true,
          });
          await page.getByRole('button', { name: /Дальше/ }).focus();
          await page.keyboard.press('Enter');
          await card
            .locator('.feedback.success')
            .waitFor({ state: 'detached' });
          await ready();
        }
        await page.getByRole('tab', { name: 'Читаю', exact: true }).click();
        await ready();
        assert.deepEqual(
          (await state()).profile.activeInstance,
          active,
          'meaning presentation modes preserve the reading route',
        );
      }
    }
    await navigate('Слова', 'Состав слова');
    await ready();
    await page.getByRole('tab', { name: 'Собираем', exact: true }).click();
    await ready();
    const beforeAuto = await state();
    const autoRouteId = beforeAuto.route.routeId;
    const autoPosition = beforeAuto.customRoutes[autoRouteId].position;
    await page.locator('.practice-menu > summary').click();
    await page
      .getByLabel('Автоматически переходить дальше', { exact: true })
      .check();
    await page
      .getByLabel('Задержка автоперехода в секундах', { exact: true })
      .fill('1');
    await page.locator('.practice-menu > summary').click();
    await solve('compose');
    await card
      .locator('.feedback.success')
      .waitFor({ state: 'detached', timeout: 5000 });
    await ready();
    const afterAuto = await state();
    assert.equal(
      afterAuto.customRoutes[autoRouteId].position,
      autoPosition + 1,
      'word trainer auto-next progresses only once',
    );
    assert.ok(
      afterAuto.profile.activeInstance,
      'word trainer auto-next opens next task',
    );
    assert.notEqual(
      afterAuto.profile.activeInstance.instanceId,
      beforeAuto.profile.activeInstance.instanceId,
    );
    await page.screenshot({
      path: path.join(output, width + '-words-auto-next.png'),
      fullPage: true,
    });
    assert.deepEqual(errors, [], 'no browser errors');
    completed.push(
      width +
        ': all four word modes, all three meaning modes, sentence/story tasks solved, word 1s auto-next, retained success, Enter next, quick settings, resume, no overflow',
    );
    await page.close();
  }
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
