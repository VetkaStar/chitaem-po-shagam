/** Real clicks exercise renderer audio controls independently from speech synthesis. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const server = await createServer({
  configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false, fs: { allow: [root] } },
  logLevel: 'error',
});
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const fixture = path.join(root, 'tests/fixtures/curriculum-option-audio.tsx').replaceAll('\\', '/');
const html = await server.transformIndexHtml('/__option-audio.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
const imageFixture = path.join(root, 'tests/fixtures/curriculum-illustration.tsx').replaceAll('\\', '/');
const imageHtml = await server.transformIndexHtml('/__illustration.html',
  `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${imageFixture}"></script></body></html>`);
let browser;
const completed = [];
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__option-audio.html*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.route('**/__illustration.html*', route => route.fulfill({ contentType: 'text/html', body: imageHtml }));
  async function open(params) {
    await page.goto(base + '/__option-audio.html?' + new URLSearchParams(params));
    await page.locator('.curriculum-task-renderer').waitFor();
  }
  const audio = () => page.getByRole('button', { name: /^Послушать/ });
  const events = () => page.evaluate(() => window.optionAudioEvents);
  for (const kind of ['read_meaning', 'passage']) {
    for (const state of [{ finished: 'false', revealed: 'false' }, { finished: 'true', revealed: 'false' }, { finished: 'false', revealed: 'true' }]) {
      await open({ kind, ...state });
      assert.equal(await audio().count(), 0, kind + ' leaked audio controls before reading/reveal');
    }
  }
  await open({ kind: 'choice', revealed: 'false' });
  assert.equal(await audio().count(), 0);
  completed.push('hidden reading/options stages expose no audio controls');
  for (const kind of ['choice', 'read_meaning', 'passage']) {
    await open({ kind, sound: 'false' });
    assert.equal(await audio().count(), 0);
  }
  completed.push('disabled sound omits all audio controls');
  for (const kind of ['choice', 'read_meaning']) {
    await open({ kind });
    await page.getByRole('button', { name: 'Послушать вариант 1', exact: true }).click();
    await page.getByRole('button', { name: 'Послушать вариант 2', exact: true }).click();
    assert.deepEqual((await events()).spoken, [[null, 'same'], [null, 'other']]);
    assert.deepEqual((await events()).submitted, []);
    assert.equal(await page.locator('.curriculum-option[aria-pressed="true"]').count(), 0);
  }
  completed.push('choice and read_meaning audio clicks preserve answers and send exact IDs');
  await open({ kind: 'passage' });
  await page.getByRole('button', { name: 'Послушать вопрос 1', exact: true }).click();
  await page.getByRole('button', { name: 'Послушать вариант 1 вопроса 1', exact: true }).click();
  await page.getByRole('button', { name: 'Послушать вопрос 2', exact: true }).click();
  await page.getByRole('button', { name: 'Послушать вариант 1 вопроса 2', exact: true }).click();
  assert.deepEqual((await events()).spoken, [['q1', null], ['q1', 'same'], ['q2', null], ['q2', 'same']]);
  assert.deepEqual((await events()).submitted, []);
  assert.equal(await page.locator('.curriculum-option[aria-pressed="true"]').count(), 0);
  completed.push('question IDs distinguish identical option IDs; audio never selects or submits');
  for (const kind of ['choice', 'read_meaning', 'passage']) {
    await open({ kind, busy: 'true' });
    const controls = await audio().all();
    assert.ok(controls.length > 0);
    for (const control of controls) {
      assert.equal(await control.isDisabled(), true);
      await control.evaluate(button => button.click());
    }
    assert.deepEqual((await events()).spoken, []);
  }
  completed.push('busy disables every audio control');
  async function openImage(kind, busy = false) {
    await page.goto(base + '/__illustration.html?' + new URLSearchParams({ kind, busy: String(busy) }));
    await page.locator('.curriculum-illustration img').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.curriculum-illustration img')]
      .every(image => image.complete && image.naturalWidth > 0));
  }
  for (const width of [390, 820, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 820 ? 1180 : 1080 });
    for (const kind of ['word', 'story']) {
      await openImage(kind);
      const images = page.locator('.curriculum-illustration img');
      assert.equal(await images.count(), kind === 'word' ? 1 : 3);
      for (const image of await images.all()) {
        assert.ok((await image.getAttribute('alt')).trim());
        const bounds = await image.boundingBox();
        assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
          kind + ' image overflow at ' + width);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      if (kind === 'story') assert.equal(await page.locator('.curriculum-illustration button').count(), 0);
    }
  }
  completed.push('real word/story assets load with alt text and fit 390/820/1920 viewports');
  await openImage('word');
  const picture = page.locator('.curriculum-illustration img');
  const original = await picture.getAttribute('src');
  await page.getByRole('button', { name: 'Другой пример', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.illustrationHarness.requested), ['alternate']);
  assert.equal(await picture.getAttribute('src'), original, 'variant changed before saved props were supplied');
  await page.evaluate(() => window.illustrationHarness.apply('alternate'));
  await page.waitForFunction(() => document.querySelector('.curriculum-illustration img').getAttribute('src').includes('-alternate.'));
  await page.waitForFunction(() => document.querySelector('.curriculum-illustration img').complete && document.querySelector('.curriculum-illustration img').naturalWidth > 0);
  assert.equal(await page.getByRole('button', { name: 'Другой пример', exact: true }).getAttribute('aria-pressed'), 'true');
  await openImage('word', true);
  for (const button of await page.locator('.curriculum-illustration button').all()) assert.equal(await button.isDisabled(), true);
  completed.push('illustration variant is controlled by persisted props; busy blocks changes');
  assert.deepEqual(errors, []);
  const report = { date: new Date().toISOString(), browser: await page.evaluate(() => navigator.userAgent), completed };
  const output = path.join(root, '.local/curriculum-option-audio-browser');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
