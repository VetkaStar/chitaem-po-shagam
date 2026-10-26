/** Check emitted production chunks, not Vite's development module graph. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { preview } from 'vite';
await import('./c01-migration.mjs');
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_PACKAGE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_PACKAGE, 'index.mjs')))
  : require('playwright');
const server = process.env.PRODUCTION_URL ? null : await preview({
  configFile: path.join(root, 'vite.pages.config.ts'), logLevel: 'error',
  preview: { host: '127.0.0.1', port: 0 },
});
const base = process.env.PRODUCTION_URL || `http://127.0.0.1:${server.httpServer.address().port}/`;
const original = JSON.parse(fs.readFileSync(path.join(root, '.local/c01/legacy-partial.json'), 'utf8'));
const patch = JSON.parse(fs.readFileSync(path.join(root, 'content/curriculum/editorial-c01.json'), 'utf8'));
const bank = JSON.parse(fs.readFileSync(path.join(root, 'content/curriculum/curriculum.json'), 'utf8'));
const output = path.resolve(root, process.env.PRODUCTION_REPORT_DIR || '.local/production-browser');
fs.mkdirSync(output, { recursive: true });
const errors = [], cases = [];
let browser;
async function snapshot(page, store = 'state', key = 'local') {
  return page.evaluate(({store, key}) => new Promise((resolve, reject) => {
    const request = indexedDB.open('reading-platform-v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(store), read = tx.objectStore(store).get(key);
      tx.oncomplete = () => { db.close(); resolve(read.result); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
  }), {store, key});
}
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  for (const legacy of [false, true]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
    // A blank same-origin page permits fixture setup without executing application code.
    await page.route('**/__production_fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture</title>' }));
    await page.goto(new URL('__production_fixture', base).href);
    await page.evaluate(async ({legacy, original}) => {
      localStorage.setItem('reading-profile-v1', JSON.stringify({name: 'Проверка', age: '8', start: 'letters'}));
      localStorage.setItem('reading-steps-v3', JSON.stringify({settings: {
        styleChosen: true, sound: false, unit: 0, length: 3, curriculumVersion: 2, motion: false,
      }, stars: 0, history: []}));
      if (legacy) await new Promise((resolve, reject) => {
        const request = indexedDB.open('reading-platform-v1', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('state'); request.result.createObjectStore('backups');
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction('state', 'readwrite');
          tx.objectStore('state').put(original, 'local');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onabort = () => { db.close(); reject(tx.error); };
        };
      });
    }, {legacy, original});
    await page.goto(base);
    const iconUrl = await page.locator('link[rel="icon"]').evaluate(el => el.href);
    const icon = await page.request.get(iconUrl);
    assert.equal(icon.status(), 200, 'site icon must load under the publication base path');
    await page.getByRole('heading', {name: 'Привет, Проверка!'}).waitFor();
    assert.equal(await page.locator('.portal-grid > .portal-card').count(), 6);
    assert.deepEqual(await page.locator('.portal-grid > .portal-card b').allTextContents(),
      ['Буквы', 'Слоги', 'Слова', 'Картинки', 'Предложения', 'Тексты']);
    assert.equal(await page.locator('.home-actions > button').count(), 3);
    await page.getByRole('button', {name: 'Все тренажёры ↓', exact: true}).click();
    assert(await page.getByRole('heading', {name: 'Все тренажёры', exact: true})
      .evaluate(el => document.activeElement === el));
    await page.keyboard.press('Tab');
    assert(await page.locator('.portal-card').first().evaluate(el => document.activeElement === el));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: path.join(output, `${legacy ? 'legacy' : 'new'}-home.png`), fullPage: true});
    const scripts = await page.locator('script[src]').evaluateAll(elements => elements.map(el => el.getAttribute('src')));
    assert(scripts.some(src => /assets\/index-.+\.js/.test(src)), 'must test emitted build');
    assert(!scripts.some(src => src.includes('@vite/client')), 'development server cannot stand in for production');
    await page.getByRole('button', {name: 'Начать занятие →', exact: true}).click();
    await page.locator('.exercise').waitFor();
    await page.locator('.task-card-actions').waitFor();
    const current = await snapshot(page);
    assert.equal(current.supply.curriculumSha256, patch.curriculumSha256);
    if (legacy) assert.deepEqual(await snapshot(page, 'backups', original.storageRevision), original);
    await page.screenshot({path: path.join(output, `${legacy ? 'legacy' : 'new'}-letters.png`)});
    await page.locator('.app-brand').click();
    await page.getByRole('button', {name: 'Учебные программы', exact: true}).click();
    await page.getByRole('heading', {name: 'Выбери свой путь'}).waitFor();
    for (const program of bank.programs) {
      await page.getByRole('button', {name: new RegExp(program.title)}).click();
      await page.getByRole('region', {name: 'Учебная программа', exact: true}).waitFor();
      assert.equal((await snapshot(page)).profile.currentProgramId, program.id);
      await page.getByRole('button', {name: 'К выбору программы', exact: true}).click();
      await page.getByRole('heading', {name: 'Выбери свой путь'}).waitFor();
    }
    await page.screenshot({path: path.join(output, `${legacy ? 'legacy' : 'new'}-programs.png`)});
    await page.reload();
    await page.getByRole('button', {name: 'Учебные программы', exact: true}).click();
    await page.getByRole('heading', {name: 'Выбери свой путь'}).waitFor();
    if (legacy) assert.deepEqual(await snapshot(page, 'backups', original.storageRevision), original);
    cases.push({profile: legacy ? 'previous supply with partial answer' : 'new', scripts, passed: true});
    await context.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({base, cases, errors}, null, 2));
  console.log('PASS production: emitted chunks, letter exposure, both programs, legacy backup/migration and reload');
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
