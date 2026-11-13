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
const server = await createServer({ configFile: path.join(root, 'vite.pages.config.ts'),
  server: { host: '127.0.0.1', port: 0, hmr: false, forwardConsole: false, fs: { allow: [root] } }, logLevel: 'error' });
await server.listen();
const base = 'http://127.0.0.1:' + server.httpServer.address().port;
const fixture = path.join(root, 'tests/fixtures/word-bridge-enter.tsx').replaceAll('\\', '/');
const html = await server.transformIndexHtml('/__bridge.html', `<!doctype html><html lang="ru"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/@fs/${fixture}"></script></body></html>`);
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('reading-steps-v3', JSON.stringify({
    settings: { unit: 12, curriculumVersion: 2, sound: false, autoSpeech: false, autoAdvance: true, autoAdvanceSeconds: 120, motion: false, breakEvery: 0, breakMinutes: 0, length: 7 },
    stars: 0, history: [], recentWords: {},
  })));
  await page.route('**/__bridge.html*', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto(base + '/__bridge.html');
  await page.waitForFunction(() => window.bridgeLesson?.ready);
  await page.evaluate(() => window.bridgeLesson.navigate('syllables', 'type'));
  await page.getByRole('textbox', { name: 'Твой ответ' }).waitFor();
  const state = () => page.evaluate(() => ({ count: window.bridgeLesson.count, stars: window.bridgeLesson.stars,
    index: window.bridgeLesson.index, history: window.bridgeLesson.history.length }));
  async function answer() {
    await page.waitForFunction(() => window.bridgeLesson.mode === 'type'
      && document.querySelector('input[aria-label="Твой ответ"]')?.disabled === false);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const target = await page.evaluate(() => window.bridgeLesson.target);
    await page.getByRole('textbox', { name: 'Твой ответ' }).fill(target);
    await page.getByRole('textbox', { name: 'Твой ответ' }).press('Enter');
    await page.getByRole('button', { name: /Дальше.*Enter/ }).waitFor();
  }
  await answer();
  await page.getByRole('button', { name: /Дальше.*Enter/ }).click();
  await answer();
  const before = await state();
  const bridge = page.getByRole('region', { name: 'Из слогов в слово' });
  await bridge.waitFor();
  const parts = (await bridge.locator('.task-instruction b').textContent()).split(' · ');
  for (const part of parts) await bridge.getByRole('button', { name: part, exact: true }).and(page.locator('button:enabled')).first().click();
  await page.getByText('Автопереход остановлен', { exact: true }).first().waitFor();
  assert.deepEqual(await state(), before, 'bridge must not grant another reward');
  await page.keyboard.press('Enter');
  const afterEnter = await state();
  if (process.env.EXPECT_BUG === '1') {
    assert.equal(afterEnter.count, before.count, 'baseline bug was not reproduced');
    console.log(JSON.stringify({ reproduced: true, before, afterEnter, focused: await page.evaluate(() => document.activeElement?.tagName) }));
  } else {
    assert.equal(afterEnter.count, before.count + 1, 'Enter must advance once after bridge');
    assert.equal(afterEnter.stars, before.stars);
    assert.equal(afterEnter.history, before.history);
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    assert.deepEqual(await state(), afterEnter, 'held Enter must not skip or reward the next task');
    await page.goto(base + '/__bridge.html?hold');
    await page.waitForFunction(() => window.bridgeLesson?.ready);
    await page.evaluate(() => window.bridgeLesson.navigate('syllables', 'type'));
    await answer();
    await page.getByRole('button', { name: /Дальше.*Enter/ }).click();
    await answer();
    const keyboardBefore = await state();
    const keyboardParts = (await bridge.locator('.task-instruction b').textContent()).split(' · ');
    for (const part of keyboardParts.slice(0, -1))
      await bridge.getByRole('button', { name: part, exact: true }).and(page.locator('button:enabled')).first().click();
    await bridge.getByRole('button', { name: keyboardParts.at(-1), exact: true }).and(page.locator('button:enabled')).first().focus();
    await page.keyboard.down('Enter');
    await page.waitForFunction(() => window.bridgeExposure.pending);
    assert.equal(await page.getByRole('button', { name: /Дальше.*Enter/ }).evaluate(button => button === document.activeElement), false,
      'completion must not restore focus before exposure is saved');
    await page.evaluate(() => window.bridgeExposure.commit());
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Дальше'));
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    assert.deepEqual(await state(), keyboardBefore, 'held final-syllable Enter must not activate newly focused Next');
    await page.keyboard.press('Enter');
    const keyboardAfter = await state();
    assert.equal(keyboardAfter.count, keyboardBefore.count + 1);
    assert.equal(keyboardAfter.stars, keyboardBefore.stars);
    assert.equal(keyboardAfter.history, keyboardBefore.history);
    assert.deepEqual(errors, []);
    const report = { date: new Date().toISOString(), before, afterEnter, keyboardBefore, keyboardAfter, completed: ['Enter advances exactly once after bridge and stopped countdown', 'held Enter does not skip', 'bridge and Enter do not duplicate awards', 'focus waits for exposure save', 'holding final-syllable Enter does not activate Next'] };
    const output = path.join(root, '.local/word-bridge-enter-browser');
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
