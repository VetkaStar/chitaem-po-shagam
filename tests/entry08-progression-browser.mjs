import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const root = process.cwd(), require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))) : require('playwright');
const dir = path.join(root, '.local/entry08-progression-browser');
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'), base: '/base/',
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/base/__progression.html`;
const html = await server.transformIndexHtml('/base/__progression.html', `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root, 'tests/fixtures/entry08-progression.tsx').replaceAll('\\','/')}"></script></body></html>`);
let browser;
const errors = [], passed = [];
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__progression.html', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(url);
  await page.getByText('Подтверждение взрослого', { exact: true }).click();
  await page.getByRole('button', { name: 'Прочитал самостоятельно', exact: true }).click();
  await page.waitForFunction(() => window.progressionFixture.snapshot().run.observations.length === 1);
  assert.equal(await page.evaluate(() => window.progressionFixture.snapshot().run.observations[0].verifier), 'companion');
  passed.push('Explicit adult UI records companion reading without microphone');
  await page.evaluate(() => window.progressionFixture.complete(false));
  await page.getByText(/Перед следующим шагом нужно/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Попробовать следующий шаг', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'К тренажёрам для подготовки', exact: true }).click();
  assert.equal(await page.title(), 'Preparation');
  passed.push('Explicitly unavailable letters show preparation reason and usable trainer exit');
  await page.evaluate(() => window.progressionFixture.complete(true));
  await page.getByRole('button', { name: 'Продолжить на этом уровне', exact: true }).click();
  assert.equal(await page.evaluate(() => window.progressionFixture.snapshot().run.cursor.nodeId), 'p1.A01');
  passed.push('Stay choice keeps current difficulty');
  await page.evaluate(() => window.progressionFixture.complete(true));
  await page.getByRole('button', { name: 'Попробовать следующий шаг', exact: true }).click();
  assert.equal(await page.evaluate(() => window.progressionFixture.snapshot().run.cursor.nodeId), 'p1.A02');
  passed.push('Explicit advance enters checked next step');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.progressionFixture.complete(true));
    await page.getByRole('button', { name: 'Попробовать следующий шаг', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(dir, `choice-${width}.png`), fullPage: true });
    await page.evaluate(() => window.progressionFixture.read());
    await page.getByText('Подтверждение взрослого', { exact: true }).click();
    await page.getByRole('button', { name: 'Прочитал самостоятельно', exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(dir, `adult-${width}.png`), fullPage: true });
  }
  passed.push('Choice and adult controls fit 1280 and 390 widths');
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ passed, errors }, null, 2));
  console.log(JSON.stringify({ suite: 'entry08-progression-browser', passed: passed.length, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
