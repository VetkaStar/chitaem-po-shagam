/** Standalone trainers: actual supply, controller, renderers and isolated IndexedDB. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(
      pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    )
  : require('playwright');
const reportDir = path.join(root, '.local/trainers-browser');
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
const fixture = path
  .join(root, 'tests/fixtures/trainers-preview.tsx')
  .replaceAll('\\', '/');
const html = await server.transformIndexHtml(
  '/base/__free-preview.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>Free practice fixture</title></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`,
);
const completed = [],
  errors = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  await context.route('**/__free-preview.html*', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  const snapshot = () =>
    page.evaluate(() => window.trainersHarness.controller.snapshot());
  const idle = async () =>
    page.waitForFunction(
      () => !document.querySelector('.trainer-session[aria-busy="true"]'),
    );
  await page.goto(address + '/base/__free-preview.html');
  await page.waitForFunction(
    () => window.trainersHarness || window.trainersError,
  );
  assert.equal(await page.evaluate(() => window.trainersError), undefined);
  const names = [
    'Собираем слова',
    'Делим на части',
    'Находим часть',
    'Меняем слово',
    'Читаем и понимаем',
    'Выбираем ответ',
  ];
  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByLabel('Заданий в занятии').selectOption('3');
    await page
      .getByRole('button', { name: 'Начать занятие', exact: true })
      .click();
    await page.locator('.curriculum-task-renderer').waitFor();
    await idle();
    const started = await snapshot();
    assert.equal(started.studyMode, 'custom');
    assert.equal(
      ['not_started', 'deferred'].includes(started.onboarding.setupStatus),
      true,
    );
    const route = started.customRoutes[started.route.routeId];
    assert.equal(route.steps.length, 3);
    assert.equal(started.profile.activeInstance.context, 'free');
    const instance = started.profile.activeInstance.instanceId;
    await page
      .getByRole('button', { name: 'Все тренажёры', exact: true })
      .click();
    await page.getByRole('button', { name, exact: true }).click();
    await page
      .getByRole('button', { name: 'Продолжить занятие', exact: true })
      .click();
    await page.locator('.curriculum-task-renderer').waitFor();
    await idle();
    assert.equal(
      (await snapshot()).profile.activeInstance.instanceId,
      instance,
    );
    for (let index = 0; index < 3; index++) {
      await page
        .getByRole('button', { name: 'Пропустить', exact: true })
        .click();
      await idle();
      if (index < 2) {
        await page
          .getByRole('button', { name: 'Следующее задание', exact: true })
          .click();
        await page.locator('.curriculum-task-renderer').waitFor();
        await idle();
      }
    }
    await page
      .getByRole('region', { name: 'Итог занятия', exact: true })
      .waitFor();
    assert.equal((await snapshot()).customRoutes[route.routeId].position, 3);
    await page
      .getByRole('button', { name: 'Повторить занятие', exact: true })
      .click();
    await page.locator('.curriculum-task-renderer').waitFor();
    await idle();
    const repeated = await snapshot();
    assert.notEqual(repeated.route.routeId, route.routeId);
    assert.deepEqual(
      repeated.customRoutes[repeated.route.routeId].steps.map(
        (step) => step.itemId,
      ),
      route.steps.map((step) => step.itemId),
    );
    await page
      .getByRole('button', { name: 'Все тренажёры', exact: true })
      .click();
    completed.push(name + ': start, persisted resume, next, summary, repeat');
  }
  for (const length of [5, 7]) {
    await page
      .getByRole('button', { name: 'Собираем слова', exact: true })
      .click();
    await page.getByLabel('Заданий в занятии').selectOption(String(length));
    await page
      .getByRole('button', { name: 'Начать занятие', exact: true })
      .click();
    await page.locator('.curriculum-task-renderer').waitFor();
    await idle();
    const started = await snapshot();
    assert.equal(
      started.customRoutes[started.route.routeId].steps.length,
      length,
    );
    if (length === 5) {
      const parts = await page.evaluate(() => {
        const { controller, supply } = window.trainersHarness;
        const item =
          supply.curriculum.items[
            controller.snapshot().profile.activeInstance.itemId
          ];
        return item.parts;
      });
      assert.equal(parts.length > 0, true);
      for (const part of parts)
        await page
          .locator('.curriculum-token-bank button:enabled')
          .filter({ hasText: new RegExp('^' + part + '$') })
          .first()
          .click();
      const before = await snapshot();
      await page.evaluate(() => window.trainersHarness.failNext());
      await page.getByRole('button', { name: 'Ответить', exact: true }).click();
      await page.getByRole('alert').first().waitFor();
      await idle();
      assert.deepEqual(await snapshot(), before);
      await page.getByRole('button', { name: 'Ответить', exact: true }).click();
      await idle();
      const accepted = await snapshot();
      assert.equal(
        accepted.profile.receipts[before.profile.activeInstance.instanceId]
          .outcome,
        'correct',
      );
      assert.equal(accepted.customRoutes[accepted.route.routeId].position, 1);
      await page.reload();
      await page
        .getByRole('button', { name: 'Собираем слова', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Следующее задание', exact: true })
        .click();
      await page.locator('.curriculum-task-renderer').waitFor();
      await idle();
      assert.equal((await snapshot()).route.routeId, started.route.routeId);
      completed.push(
        'correct composition, failed commit leaves exact snapshot, retry and reload',
      );
    }
    const startIndex = length === 5 ? 1 : 0;
    for (let index = startIndex; index < length; index++) {
      await page
        .getByRole('button', { name: 'Пропустить', exact: true })
        .click();
      await idle();
      if (index < length - 1) {
        await page
          .getByRole('button', { name: 'Следующее задание', exact: true })
          .click();
        await page.locator('.curriculum-task-renderer').waitFor();
        await idle();
      }
    }
    await page
      .getByRole('region', { name: 'Итог занятия', exact: true })
      .waitFor();
    assert.equal(
      (await snapshot()).customRoutes[started.route.routeId].position,
      length,
    );
    await page
      .getByRole('button', { name: 'Все тренажёры', exact: true })
      .click();
    completed.push('session length ' + length + ' across shared visit budgets');
  }
  const staged = await page.evaluate(async () => {
    const { controller, supply } = window.trainersHarness;
    const item = Object.values(supply.curriculum.items).find(
      (task) => task.kind === 'transform' && task.requiresFollowupReading,
    );
    const routeId = 'trainer:transform:' + crypto.randomUUID();
    await controller.registerCustomRoute({
      source: 'custom',
      routeId,
      version: 1,
      position: 0,
      suspendedInstance: null,
      steps: [0, 1, 2].map((index) => ({
        id: routeId + ':' + index,
        itemId: item.id,
        mode: 'read',
      })),
    });
    await controller.selectCustomRoute(routeId);
    const visit = controller.snapshot().profile.currentVisit;
    if (!visit || visit.actions >= visit.budget) {
      if (visit) await controller.endVisit();
      await controller.beginVisit(crypto.randomUUID(), 3);
    }
    await controller.launch(await controller.planNext());
    return {
      routeId,
      answer: item.answer.value,
      instanceId: controller.snapshot().profile.activeInstance.instanceId,
    };
  });
  await page.getByRole('button', { name: 'Меняем слово', exact: true }).click();
  await page.getByLabel('Напиши, что получилось').fill(staged.answer);
  await page.getByRole('button', { name: 'Ответить', exact: true }).click();
  await page
    .getByRole('button', { name: 'Взрослый: прочитано верно', exact: true })
    .click();
  await idle();
  assert.equal(
    (await snapshot()).sourceEvents.filter(
      (event) =>
        event.instanceId === staged.instanceId && event.kind === 'answer',
    ).length,
    2,
  );
  for (let index = 0; index < 2; index++) {
    await page
      .getByRole('button', { name: 'Следующее задание', exact: true })
      .click();
    await page.locator('.curriculum-task-renderer').waitFor();
    await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await idle();
  }
  const summary = page.getByRole('region', {
    name: 'Итог занятия',
    exact: true,
  });
  await summary.waitFor();
  assert.equal(
    await summary.getByText('Ответов принято: 1.', { exact: true }).isVisible(),
    true,
  );
  completed.push(
    'staged transformation counts one receipt despite two answer events',
  );
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: path.join(reportDir, 'trainers.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify({ completed, errors }, null, 2),
  );
  console.log(
    `PASS standalone trainers browser: ${completed.length} scenarios`,
  );
} finally {
  await browser?.close();
  await server.close();
}
