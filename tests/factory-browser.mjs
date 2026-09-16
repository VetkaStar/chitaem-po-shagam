import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import { createLevel } from '../public/games/factory/model.js';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs'))) : require('playwright');
const report = path.resolve('.local/factory-browser');
fs.mkdirSync(report, { recursive: true });
const server = await createServer({ configFile: path.resolve('vite.pages.config.ts'), base: '/preview/', server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/preview/games/factory/index.html`;
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.goto(url);
  await page.locator('#board .tile').last().waitFor();
  await page.screenshot({ path: path.join(report, 'desktop.png'), fullPage: true });
  await page.locator('#launch').click();
  await page.waitForFunction(() => document.querySelector('#status').classList.contains('error'));
  assert.equal(await page.locator('.broken').count(), 1);
  await page.locator('#board button:enabled').first().click();
  assert.equal(await page.locator('.broken').count(), 0);
  await page.locator('#reset').click();
  const first = page.locator('#board button:enabled').first();
  await first.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#turns').textContent(), '1');
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#turns').textContent(), '2');
  for (let d = 0; d < 3; d++) {
    await page.locator(`[data-difficulty="${d}"]`).click();
    for (let i = 0; i < 4; i++) {
      await page.locator('#levels button').nth(i).click();
      const level = createLevel(d, i);
      for (let cell = 0; cell < level.tiles.length; cell++) {
        const tile = level.tiles[cell];
        if (tile.fixed || tile.kind === 'wall') continue;
        for (let r = 0; r < (4 - tile.rotation) % 4; r++) await page.locator('#board button').nth(cell).click();
      }
      await page.locator('#launch').click();
      await page.locator('#success:visible').waitFor();
      assert.match(await page.locator('#status').textContent(), /Уровень пройден/);
    }
  }
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('little-factory-progress-v1')).length), 12);
  await page.reload();
  assert.equal(await page.locator('#levels .complete').count(), 4);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#launch').click();
  await page.locator('[data-difficulty="2"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#turns').textContent(), '0');
  assert.equal(await page.locator('.visited').count(), 0);
  assert.equal(await page.locator('#launch').isEnabled(), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 641, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, tile: document.querySelector('#board button').getBoundingClientRect().width }));
    assert.equal(geometry.overflow, false, `Overflow at ${width}`);
    assert(geometry.tile >= 44, `Small tile at ${width}: ${geometry.tile}`);
    if (width === 390) await page.screenshot({ path: path.join(report, 'mobile.png'), fullPage: true });
  }
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const mobile = await touch.newPage();
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url);
  await mobile.locator('#board button:enabled').first().tap();
  assert.equal(await mobile.locator('#turns').textContent(), '1');
  await touch.close();
  const noStorage = await browser.newContext();
  await noStorage.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } }); });
  const privatePage = await noStorage.newPage();
  privatePage.on('pageerror', error => errors.push(error.message));
  await privatePage.goto(url);
  await privatePage.locator('#board button:enabled').first().click();
  assert.equal(await privatePage.locator('#turns').textContent(), '1');
  await noStorage.close();
  assert.deepEqual(errors, []);
  console.log('Factory browser: 12 victories, retry, keyboard, cancellation, storage, 5 widths and touch passed.');
} finally { await browser.close(); await server.close(); }

