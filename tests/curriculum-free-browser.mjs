/** Real exposure hooks and state-preserving gates, with controlled durable writes. */
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
const reportDir = path.join(root, '.local/curriculum-free-browser');
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
  .join(root, 'tests/fixtures/free-practice-preview.tsx')
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
    page.evaluate(() => window.freePracticeHarness.snapshot());
  const pending = () =>
    page.waitForFunction(
      () => window.freePracticeHarness.snapshot().pending.length > 0,
    );
  const commit = async () => {
    await page.evaluate(() => window.freePracticeHarness.commit());
    await page.waitForFunction(
      () => window.freePracticeHarness.snapshot().ready,
    );
  };
  await page.goto(address + '/base/__free-preview.html');
  await page.waitForFunction(
    () => window.freePracticeHarness?.snapshot().pending.length >= 2,
  );
  assert.equal((await snapshot()).ready, false);
  assert.equal(await page.locator('h1').isVisible(), false);
  assert.equal(await page.locator('.word-bridge').isVisible(), false);
  assert.equal(
    await page
      .getByRole('button', { name: 'Счётчик 0', includeHidden: true })
      .evaluate((node) => !!node.closest('[inert]')),
    true,
  );
  await commit();
  assert.equal(
    await page.getByRole('heading', { name: 'КОТ', exact: true }).isVisible(),
    true,
  );
  completed.push(
    'material remains invisible and inert until all durable writes commit',
  );

  await page.getByRole('button', { name: 'Счётчик 0', exact: true }).click();
  await page.getByRole('button', { name: 'МУ', exact: true }).click();
  await pending();
  await commit();
  assert.deepEqual(await page.locator('.bridge-slots span').allTextContents(), [
    'МУ',
    '…',
  ]);
  assert.equal(
    (await snapshot()).calls.some((entry) => entry.texts?.includes('МУХА')),
    false,
  );
  await page
    .getByRole('button', { name: 'Сменить материал', exact: true })
    .click();
  await pending();
  assert.equal(await page.locator('.word-bridge').isVisible(), false);
  await commit();
  assert.equal(
    await page
      .getByRole('button', { name: 'Счётчик 1', exact: true })
      .isVisible(),
    true,
  );
  assert.deepEqual(await page.locator('.bridge-slots span').allTextContents(), [
    'МУ',
    '…',
  ]);
  assert.equal(
    await page.getByRole('button', { name: 'МУ', exact: true }).isDisabled(),
    true,
  );
  completed.push(
    'parent exposure change preserves child counter and actual WordBridge selection',
  );

  await page.getByRole('button', { name: 'ХА', exact: true }).click();
  await pending();
  assert.equal(
    (await snapshot()).pending.some((entry) => entry.texts?.includes('МУХА')),
    true,
  );
  assert.equal(await page.locator('.word-bridge').isVisible(), false);
  await commit();
  assert.deepEqual(await page.locator('.bridge-slots span').allTextContents(), [
    'МУ',
    'ХА',
  ]);
  completed.push(
    'whole bridge word is recorded only when assembled and before reveal',
  );

  await page
    .getByRole('button', { name: 'Сменить материал', exact: true })
    .click();
  await pending();
  await page.evaluate(() => window.freePracticeHarness.fail());
  await page.getByRole('alert').waitFor();
  assert.equal((await snapshot()).ready, false);
  assert.equal(await page.locator('h1').isVisible(), false);
  await page
    .getByRole('button', { name: 'Повторить попытку', exact: true })
    .click();
  await pending();
  await commit();
  assert.equal(
    await page
      .getByRole('button', { name: 'Счётчик 1', exact: true })
      .isVisible(),
    true,
  );
  assert.deepEqual(await page.locator('.bridge-slots span').allTextContents(), [
    'МУ',
    'ХА',
  ]);
  completed.push(
    'failed storage stays blocked; retry preserves material and child state',
  );

  await page.evaluate(() => window.freePracticeHarness.say('бэ', 'Б'));
  await pending();
  assert.deepEqual((await snapshot()).pending.at(-1), {
    texts: ['Б'],
    promptedTexts: ['Б'],
    heardPassages: [],
  });
  assert.deepEqual((await snapshot()).spoken, []);
  await commit();
  await page.waitForFunction(
    () => window.freePracticeHarness.snapshot().spoken.length === 1,
  );
  assert.deepEqual((await snapshot()).spoken, ['бэ']);
  completed.push(
    'explicit letter target is recorded before its different spoken name',
  );

  assert.equal((await snapshot()).readiness.includes(false), true);
  assert.equal((await snapshot()).readiness.at(-1), true);
  await page.goto(address + '/base/__free-preview.html?standalone=1');
  await page.getByRole('heading', { name: 'КОТ', exact: true }).waitFor();
  assert.equal((await snapshot()).ready, true);
  assert.deepEqual((await snapshot()).calls, []);
  completed.push(
    'without provider existing exercises remain immediately usable',
  );
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: path.join(reportDir, 'free-practice.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(reportDir, 'report.json'),
    JSON.stringify({ completed, errors }, null, 2),
  );
  console.log(`PASS free practice browser: ${completed.length} scenarios`);
} finally {
  await browser?.close();
  await server.close();
}
