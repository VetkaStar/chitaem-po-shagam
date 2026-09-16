/** Real section → core trainer → answer mode, with isolated persisted sessions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createServer } from 'vite';
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const bank = JSON.parse(fs.readFileSync(path.join(root, 'content/curriculum/curriculum.json'), 'utf8'));
const sectionCode = ts.transpileModule(
  fs.readFileSync(path.join(root, 'features/trainers/task-section.ts'), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const { taskSection } = await import('data:text/javascript;base64,' + Buffer.from(sectionCode).toString('base64'));
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
const output = path.join(root, '.local/section-answers-browser');
fs.mkdirSync(output, { recursive: true });
const completed = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  for (const [width, height] of [[390, 844], [1920, 1080]]) {
    for (const section of [
      { id: 'letters', title: 'Буквы', core: 'Буква', sample: 'Послушать букву', step: 1 },
      { id: 'syllables', title: 'Слоги', core: 'Слог', sample: 'Послушать слог', step: 2 },
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({ sectionId }) => {
        if (!localStorage.getItem('reading-profile-v1')) {
          localStorage.setItem('reading-profile-v1', JSON.stringify({ name: 'Режимы', age: '8', start: sectionId }));
          localStorage.setItem('reading-steps-v3', JSON.stringify({ settings: {
            styleChosen: true, sound: true, autoSpeech: false, layout: 'order',
            unit: 12, length: 3, curriculumVersion: 2, motion: false,
          }, stars: 0, history: [] }));
        }
        window.sectionTestSpoken = [];
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
          cancel() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {},
          speak(utterance) { window.sectionTestSpoken.push(utterance.text); queueMicrotask(() => utterance.onend?.()); },
        } });
      }, { sectionId: section.id });
      const saved = () => page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open('reading-platform-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('state', 'readonly');
          const read = tx.objectStore('state').get('local');
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
          tx.oncomplete = () => db.close();
        };
      }));
      const enter = async () => {
        await page.locator('.portal-grid').getByRole('button', { name: new RegExp('ШАГ ' + section.step + ' ' + section.title) }).click();
        await page.locator('.portal-grid').getByRole('button', { name: section.core, exact: true }).click();
        await page.getByRole('tab', { name: 'Отвечаю', exact: true }).click();
        await page.locator('.answer-exercise').waitFor().catch(async error => { console.error(section.id, width, await page.locator('body').innerText(), errors); throw error; });
        await page.waitForFunction(() => document.querySelector('.answer-exercise')?.getAttribute('aria-busy') === 'false');
      };
      await page.goto(base);
      await enter();
      const state = await saved();
      const route = state.customRoutes[state.route.routeId];
      assert.ok(route.routeId.startsWith(`answer:${section.id}:12:`));
      assert.equal(route.steps.length, 3);
      for (const step of route.steps) {
        assert.ok(bank.items[step.itemId], 'reference must point to the supplied task');
        assert.equal(bank.items[step.itemId].kind, 'choice');
        assert.equal(taskSection(bank.items[step.itemId]), section.id);
      }
      const active = state.profile.activeInstance;
      const target = bank.items[active.itemId].learnerText;
      assert.equal((await page.locator('.answer-material').textContent()).trim(), target.trim());
      assert.equal(await page.locator('.answer-material').getAttribute('data-section'), section.id);
      assert.equal(await page.getByRole('tab', { name: 'Отвечаю', exact: true }).getAttribute('aria-selected'), 'true');
      for (const name of ['Читаю', 'Ловлю', 'Пишу'])
        assert.equal(await page.getByRole('tab', { name, exact: true }).isVisible(), true);
      assert.equal(await page.getByRole('tab').count(), 4);
      const selectedCore = page.locator('.app-nav-child[aria-current="page"]');
      assert.equal(await selectedCore.count(), 1);
      assert.equal((await selectedCore.textContent()).trim(), section.core);
      const audio = page.getByRole('button', { name: section.sample, exact: true });
      assert.equal(await audio.isVisible(), true);
      await audio.click();
      await page.waitForFunction(() => window.sectionTestSpoken.length > 0);
      assert.ok((await page.evaluate(() => window.sectionTestSpoken)).includes(target));
      await page.screenshot({ path: path.join(output, `${width}-${section.id}.png`), fullPage: true });
      await page.reload();
      await enter();
      const restored = await saved();
      assert.equal(restored.route.routeId, route.routeId);
      assert.equal(restored.profile.activeInstance.instanceId, active.instanceId);
      assert.equal((await page.locator('.answer-material').textContent()).trim(), target.trim());
      assert.equal((await selectedCore.textContent()).trim(), section.core);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      completed.push(`${width} ${section.id}: authored pool, four tabs, sample label/audio, selected core, reload exact instance`);
      await context.close();
    }
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ completed }, null, 2));
  console.log(`PASS section answers browser: ${completed.length} scenarios`);
} finally {
  await browser?.close();
  await server.close();
}
