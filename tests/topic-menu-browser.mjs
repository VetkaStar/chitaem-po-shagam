import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const { chromium } = await import(
  process.env.PLAYWRIGHT_PACKAGE
    ? pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))
    : 'playwright'
);
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  logLevel: 'error',
  server: {
    host: '127.0.0.1',
    port: 0,
    hmr: false,
    forwardConsole: false,
    fs: { allow: [root] },
  },
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const fixture = path
  .join(root, 'tests/fixtures/topic-menu.tsx')
  .replaceAll('\\', '/');
const html = await server.transformIndexHtml(
  '/__topic-menu.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`,
);
const passed = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || 'msedge',
  });
  for (const compact of [false, true])
    for (const width of [390, 820, 1920]) {
      const context = await browser.newContext({
        viewport: { width, height: 1180 },
        hasTouch: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/__topic-menu.html*', (route) =>
        route.fulfill({ contentType: 'text/html', body: html }),
      );
      await page.goto(base + '/__topic-menu.html?compact=' + compact);
      const trigger = page.getByRole('button', {
        name: /^Выбрать другую тему/,
      });
      const menu = page.locator('.topic-options');
      const selected = page.getByTestId('selection');
      const isClosed = async () => {
        await page.waitForFunction(
          () => !document.querySelector('.topic-options'),
        );
        assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      };
      await trigger.click();
      await menu.waitFor();
      await page.locator('#outside-before').click();
      await isClosed();
      assert.equal(await selected.textContent(), '0:0');
      await trigger.tap();
      await menu.waitFor();
      await page.locator('#outside-before').tap();
      await isClosed();
      assert.equal(await selected.textContent(), '0:0');
      await trigger.click();
      await menu.getByRole('button').nth(1).click();
      await isClosed();
      assert.equal(await selected.textContent(), '1:1');
      const before = await trigger.boundingBox();
      await trigger.click();
      await menu.waitFor();
      assert.deepEqual(
        await trigger.boundingBox(),
        before,
        'opening moved the upper control',
      );
      await trigger.click();
      await isClosed();
      await trigger.click();
      await menu.getByRole('button').nth(0).focus();
      await page.keyboard.press('Escape');
      await isClosed();
      assert(
        await trigger.evaluate((element) => element === document.activeElement),
      );
      await trigger.click();
      await page.locator('#outside-before').focus();
      await isClosed();
      assert.equal(await selected.textContent(), '1:1');
      assert.deepEqual(errors, []);
      passed.push({
        compact,
        width,
        checks: [
          'mouse outside',
          'touch outside',
          'selection once',
          'toggle',
          'Escape/focus return',
          'focus outside',
          'stable trigger',
        ],
      });
      await context.close();
    }
  for (const width of [390, 820, 1920])
    for (const interfaceScale of [100, 120]) {
      const context = await browser.newContext({
        viewport: { width, height: 1180 },
      });
      await context.addInitScript((scale) => {
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
              layout: 'focus',
              look: 'plain',
              paper: 'main',
              styleChosen: true,
              interfaceScale: scale,
              sound: false,
              autoSpeech: false,
              motion: false,
              breakEvery: 0,
              breakMinutes: 0,
              autoAdvance: false,
            },
            stars: 0,
            history: [],
            recentWords: {},
          }),
        );
      }, interfaceScale);
      const page = await context.newPage();
      await page.goto(base + '/');
      await page.locator('.portal-card').filter({ hasText: 'Слоги' }).click();
      const trigger = page.getByRole('button', {
        name: /^Выбрать другую тему/,
      });
      const before = await trigger.boundingBox();
      await trigger.click();
      const menu = page.locator('.topic-options');
      await menu.waitFor();
      const after = await trigger.boundingBox(),
        list = await menu.boundingBox();
      assert.deepEqual(after, before);
      assert(
        list.y >= after.y + after.height,
        'actual menu overlaps its trigger',
      );
      assert(
        list.x >= -1 && list.x + list.width <= width + 1,
        'actual menu exceeds viewport: ' +
          JSON.stringify({ width, interfaceScale, after, list }),
      );
      await trigger.click();
      assert.equal(await menu.count(), 0);
      await trigger.click();
      await page.mouse.click(width - 2, 1170);
      await page.waitForFunction(
        () => !document.querySelector('.topic-options'),
      );
      assert.equal(await menu.count(), 0);
      passed.push({
        actualApp: true,
        width,
        interfaceScale,
        checks: [
          'menu below trigger',
          'fits viewport',
          'repeat trigger',
          'outside page click',
        ],
      });
      await context.close();
    }
  fs.mkdirSync(path.join(root, '.local/topic-menu-browser'), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, '.local/topic-menu-browser/report.json'),
    JSON.stringify({ passed }, null, 2),
  );
  console.log(
    'PASS topic menu: both layouts at 390/820/1920, mouse, touch, keyboard and unchanged selection',
  );
} finally {
  await browser?.close();
  await server.close();
}
